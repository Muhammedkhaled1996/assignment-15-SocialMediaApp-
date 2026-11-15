import { Request } from "express";
import { FlightLotModel } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { Money, withTransaction } from "../../common/utils";
import { supplierService } from "../suppliers";

export class FlightLotRepository extends DatabaseRepository<any> {
  constructor() {
    super(FlightLotModel);
  }
}

export class FlightService {
  private repo = new FlightLotRepository();

  async listFlightLots(query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.status) filter.status = query.status;
    if (query.airline) filter.airline = { $regex: query.airline, $options: "i" };
    if (query.supplierId) filter.supplierId = query.supplierId;
    if (query.purchaseSource) filter.purchaseSource = query.purchaseSource;

    return await this.repo.paginate({
      filter,
      options: { populate: [{ path: "supplierId", select: "code nameAr nameEn" }], sort: { departureDate: 1 } },
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 25,
    });
  }

  async getFlightLotById(id: string) {
    const lot = await FlightLotModel.findById(id).populate("supplierId brokerId").lean();
    if (!lot) throw new NotFoundException("Flight lot not found");
    return lot;
  }

  async createFlightLot(payload: any, req: Request) {
    const depDate = new Date(payload.departureDate);
    const retDate = new Date(payload.returnDate);
    if (retDate < depDate) {
      throw new BadRequestException("Return date cannot be earlier than departure date");
    }

    if (payload.purchaseSource === "BROKER" && !payload.brokerId) {
      throw new BadRequestException("brokerId is required when purchaseSource is BROKER");
    }

    const seatQuantity = Number(payload.seatQuantity);
    const unitCost = Money.round(payload.unitCost);
    const totalCost = Money.multiply(unitCost, seatQuantity);

    return await withTransaction(async (session) => {
      const contractReference =
        payload.contractReference?.toUpperCase().trim() ||
        (await sequenceService.nextReference({
          documentType: "CONTRACT",
          prefix: "FLT",
          session,
        }));

      const exists = await FlightLotModel.findOne({ contractReference }, null, session ? { session } : undefined);
      if (exists) {
        throw new ConflictException(`Flight contract reference ${contractReference} already exists`);
      }

      const [flightLot] = await FlightLotModel.create(
        [
          {
            ...payload,
            contractReference,
            departureDate: depDate,
            returnDate: retDate,
            seatQuantity,
            availableSeats: seatQuantity,
            reservedSeats: 0,
            soldSeats: 0,
            unitCost,
            totalCost,
            paidAmount: 0,
            remainingLiability: totalCost,
            status: "ACTIVE",
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      const targetLiabilitySupplierId =
        payload.purchaseSource === "BROKER" && payload.brokerId ? payload.brokerId : payload.supplierId;

      await supplierService.recordLedgerMovement({
        supplierId: targetLiabilitySupplierId,
        branchId: req.branchContext?.activeBranchId,
        entryType: "CONTRACT_OBLIGATION",
        referenceType: "FLIGHT_LOT",
        referenceId: flightLot!._id,
        referenceNumber: contractReference,
        description: `Flight Lot ${contractReference} (${payload.airline} ${payload.flightRoute}, ${seatQuantity} seats @ ${unitCost})`,
        creditAmount: totalCost,
        exchangeRateToEgp: payload.exchangeRateToEgp || 1,
        dueDate: payload.paymentSchedule?.[0]?.dueDate ? new Date(payload.paymentSchedule[0].dueDate) : depDate,
        actorId: req.user?._id,
        session,
      });

      await auditService.record({
        req,
        action: "FLIGHT_LOT_CREATED",
        module: "flights",
        entityType: "FlightLot",
        entityId: flightLot!._id.toString(),
        newValues: flightLot!.toObject(),
        session,
      });

      return flightLot!;
    });
  }

  async updateFlightLot(id: string, payload: any, req: Request) {
    const lot = await FlightLotModel.findById(id);
    if (!lot) throw new NotFoundException("Flight lot not found");
    const prev = lot.toObject();

    if (payload.seatQuantity !== undefined) {
      const committedSeats = lot.reservedSeats + lot.soldSeats;
      if (payload.seatQuantity < committedSeats) {
        throw new BadRequestException(
          `Cannot reduce seatQuantity (${payload.seatQuantity}) below already reserved/sold seats (${committedSeats})`,
        );
      }
      lot.availableSeats = payload.seatQuantity - committedSeats;
      lot.seatQuantity = payload.seatQuantity;
    }

    if (payload.unitCost !== undefined) {
      lot.unitCost = Money.round(payload.unitCost);
    }

    lot.totalCost = Money.multiply(lot.unitCost, lot.seatQuantity);
    lot.remainingLiability = Math.max(0, Money.subtract(lot.totalCost, lot.paidAmount));

    if (payload.airline) lot.airline = payload.airline;
    if (payload.flightRoute) lot.flightRoute = payload.flightRoute;
    if (payload.departureDate) lot.departureDate = new Date(payload.departureDate);
    if (payload.returnDate) lot.returnDate = new Date(payload.returnDate);
    if (payload.paymentTerms !== undefined) lot.paymentTerms = payload.paymentTerms;
    if (payload.notes !== undefined) lot.notes = payload.notes;
    if (payload.status) lot.status = payload.status;
    lot.updatedBy = req.user?._id;

    await lot.save();

    await auditService.record({
      req,
      action: "FLIGHT_LOT_UPDATED",
      module: "flights",
      entityType: "FlightLot",
      entityId: lot._id.toString(),
      previousValues: prev,
      newValues: lot.toObject(),
    });

    return lot;
  }

  async archiveFlightLot(id: string, req: Request) {
    const lot = await FlightLotModel.findById(id);
    if (!lot) throw new NotFoundException("Flight lot not found");
    if (lot.reservedSeats > 0) {
      throw new ConflictException("Cannot archive flight lot while seats are actively reserved");
    }
    const prev = lot.toObject();
    lot.status = "ARCHIVED";
    lot.updatedBy = req.user?._id;
    await lot.save();

    await auditService.record({
      req,
      action: "FLIGHT_LOT_ARCHIVED",
      module: "flights",
      entityType: "FlightLot",
      entityId: lot._id.toString(),
      previousValues: prev,
      newValues: lot.toObject(),
    });

    return lot;
  }
}

export const flightService = new FlightService();
export default flightService;
