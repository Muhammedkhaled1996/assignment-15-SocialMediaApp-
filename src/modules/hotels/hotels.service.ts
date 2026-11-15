import { Request } from "express";
import { HotelContractModel, HotelModel, HotelPricingMode } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { Money, withTransaction } from "../../common/utils";
import { supplierService } from "../suppliers";

export class HotelContractRepository extends DatabaseRepository<any> {
  constructor() {
    super(HotelContractModel);
  }
}

export class HotelService {
  private contractRepo = new HotelContractRepository();

  /**
   * Deterministic Hotel Contract Rate & Valuation Engine.
   *
   * Policy:
   * - Distinguishes strictly between PER-ROOM nightly rates and PER-PERSON stay rates.
   * - FLAT_RATE: Single room rate per night (`flatRoomRatePerNight`) applies to all room types (Double, Triple, Quad).
   * - TIERED_RATE: Distinct nightly room rates (`doubleRoomRatePerNight`, `tripleRoomRatePerNight`, `quadRoomRatePerNight`).
   * - Per-person nightly rate = RoomRatePerNight / occupancy (2 for Double, 3 for Triple, 4 for Quad).
   * - Per-person stay rate = (RoomRatePerNight * nights) / occupancy.
   * - Total contract value = nights * ((doubleRooms * doubleRoomRate) + (tripleRooms * tripleRoomRate) + (quadRooms * quadRoomRate)).
   */
  calculateHotelContractPricing(input: {
    pricingMode: HotelPricingMode;
    nights: number;
    singleRooms?: number | undefined;
    doubleRooms: number;
    tripleRooms: number;
    quadRooms: number;
    flatRoomRatePerNight?: number | undefined;
    singleRoomRatePerNight?: number | undefined;
    doubleRoomRatePerNight?: number | undefined;
    tripleRoomRatePerNight?: number | undefined;
    quadRoomRatePerNight?: number | undefined;
  }) {
    const nights = Math.floor(input.nights);
    if (nights < 1) {
      throw new BadRequestException("Hotel stay nights must be at least 1");
    }

    const singleRooms = Math.max(0, Math.floor(input.singleRooms || 0));
    const doubleRooms = Math.max(0, Math.floor(input.doubleRooms || 0));
    const tripleRooms = Math.max(0, Math.floor(input.tripleRooms || 0));
    const quadRooms = Math.max(0, Math.floor(input.quadRooms || 0));
    const totalRooms = singleRooms + doubleRooms + tripleRooms + quadRooms;
    const totalBeds = singleRooms * 1 + doubleRooms * 2 + tripleRooms * 3 + quadRooms * 4;

    if (totalRooms < 1) {
      throw new BadRequestException("Hotel contract must include at least 1 room");
    }

    let singleRoomRatePerNight = 0;
    let doubleRoomRatePerNight = 0;
    let tripleRoomRatePerNight = 0;
    let quadRoomRatePerNight = 0;
    let flatRoomRatePerNight: number | undefined;

    if (input.pricingMode === "FLAT_RATE") {
      if (input.flatRoomRatePerNight === undefined || input.flatRoomRatePerNight <= 0) {
        throw new BadRequestException("flatRoomRatePerNight must be > 0 for FLAT_RATE pricing mode");
      }
      flatRoomRatePerNight = Money.round(input.flatRoomRatePerNight);
      singleRoomRatePerNight = flatRoomRatePerNight;
      doubleRoomRatePerNight = flatRoomRatePerNight;
      tripleRoomRatePerNight = flatRoomRatePerNight;
      quadRoomRatePerNight = flatRoomRatePerNight;
    } else {
      singleRoomRatePerNight = Money.round(input.singleRoomRatePerNight ?? 0);
      doubleRoomRatePerNight = Money.round(input.doubleRoomRatePerNight ?? 0);
      tripleRoomRatePerNight = Money.round(input.tripleRoomRatePerNight ?? 0);
      quadRoomRatePerNight = Money.round(input.quadRoomRatePerNight ?? 0);
      if (
        (singleRooms > 0 && singleRoomRatePerNight <= 0) ||
        (doubleRooms > 0 && doubleRoomRatePerNight <= 0) ||
        (tripleRooms > 0 && tripleRoomRatePerNight <= 0) ||
        (quadRooms > 0 && quadRoomRatePerNight <= 0)
      ) {
        throw new BadRequestException("Positive room rate per night is required for each contracted room type in TIERED_RATE mode");
      }
    }

    const singlePerPersonPerNight = singleRoomRatePerNight;
    const doublePerPersonPerNight = Money.divide(doubleRoomRatePerNight, 2);
    const triplePerPersonPerNight = Money.divide(tripleRoomRatePerNight, 3);
    const quadPerPersonPerNight = Money.divide(quadRoomRatePerNight, 4);

    const singleRoomStayCost = Money.multiply(singleRoomRatePerNight, nights);
    const doubleRoomStayCost = Money.multiply(doubleRoomRatePerNight, nights);
    const tripleRoomStayCost = Money.multiply(tripleRoomRatePerNight, nights);
    const quadRoomStayCost = Money.multiply(quadRoomRatePerNight, nights);

    const singlePerPersonStayRate = singleRoomStayCost;
    const doublePerPersonStayRate = Money.divide(doubleRoomStayCost, 2);
    const triplePerPersonStayRate = Money.divide(tripleRoomStayCost, 3);
    const quadPerPersonStayRate = Money.divide(quadRoomStayCost, 4);

    const contractValue = Money.add(
      Money.multiply(singleRoomStayCost, singleRooms),
      Money.multiply(doubleRoomStayCost, doubleRooms),
      Money.multiply(tripleRoomStayCost, tripleRooms),
      Money.multiply(quadRoomStayCost, quadRooms),
    );

    return {
      roomCapacities: {
        ...(input.singleRooms !== undefined ? { singleRooms } : {}),
        doubleRooms,
        tripleRooms,
        quadRooms,
        totalRooms,
        totalBeds,
      },
      rates: {
        flatRoomRatePerNight,
        ...(input.singleRoomRatePerNight !== undefined ? { singleRoomRatePerNight, singlePerPersonPerNight, singlePerPersonStayRate } : {}),
        doubleRoomRatePerNight,
        tripleRoomRatePerNight,
        quadRoomRatePerNight,
        doublePerPersonPerNight,
        triplePerPersonPerNight,
        quadPerPersonPerNight,
        doublePerPersonStayRate,
        triplePerPersonStayRate,
        quadPerPersonStayRate,
      },
      contractValue,
    };
  }

  async createHotel(payload: any, req: Request) {
    const city = String(payload.city || "").toUpperCase().trim();
    const defaultCountry = city === "MAKKAH" || city === "MADINAH" ? "SA" : "EG";
    const hotel = await HotelModel.create({
      ...payload,
      city,
      country: (payload.country || defaultCountry).toUpperCase().trim(),
      createdBy: req.user?._id,
    });
    await auditService.record({
      req,
      action: "HOTEL_CREATED",
      module: "hotels",
      entityType: "Hotel",
      entityId: hotel._id.toString(),
      newValues: hotel.toObject(),
    });
    return hotel;
  }

  async createHotelContract(payload: any, req: Request) {
    const hotel = await HotelModel.findById(payload.hotelId);
    if (!hotel) {
      throw new NotFoundException("Hotel not found");
    }

    const checkIn = new Date(payload.checkIn);
    const checkOut = new Date(payload.checkOut);
    if (checkOut <= checkIn) {
      throw new BadRequestException("checkOut date must be after checkIn date");
    }

    const diffNights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const nights = payload.nights ? Number(payload.nights) : diffNights;

    const calculated = this.calculateHotelContractPricing({
      pricingMode: payload.pricingMode,
      nights,
      singleRooms: payload.roomCapacities.singleRooms,
      doubleRooms: payload.roomCapacities.doubleRooms,
      tripleRooms: payload.roomCapacities.tripleRooms,
      quadRooms: payload.roomCapacities.quadRooms,
      flatRoomRatePerNight: payload.rates?.flatRoomRatePerNight,
      singleRoomRatePerNight: payload.rates?.singleRoomRatePerNight,
      doubleRoomRatePerNight: payload.rates?.doubleRoomRatePerNight,
      tripleRoomRatePerNight: payload.rates?.tripleRoomRatePerNight,
      quadRoomRatePerNight: payload.rates?.quadRoomRatePerNight,
    });

    return await withTransaction(async (session) => {
      const contractNumber =
        payload.contractNumber?.toUpperCase().trim() ||
        (await sequenceService.nextReference({
          documentType: "CONTRACT",
          prefix: "HTL",
          session,
        }));

      const exists = await HotelContractModel.findOne({ contractNumber }, null, session ? { session } : undefined);
      if (exists) {
        throw new ConflictException(`Hotel contract ${contractNumber} already exists`);
      }

      const [contract] = await HotelContractModel.create(
        [
          {
            contractNumber,
            hotelId: hotel._id,
            supplierId: payload.supplierId,
            city: (payload.city || hotel.city).toUpperCase().trim(),
            checkIn,
            checkOut,
            nights,
            roomCapacities: calculated.roomCapacities,
            allocatedRooms: { singleRooms: 0, doubleRooms: 0, tripleRooms: 0, quadRooms: 0 },
            pricingMode: payload.pricingMode,
            currency: payload.currency || "SAR",
            rates: calculated.rates,
            contractValue: calculated.contractValue,
            paidAmount: 0,
            remainingLiability: calculated.contractValue,
            paymentTerms: payload.paymentTerms,
            dueDate: payload.dueDate ? new Date(payload.dueDate) : checkIn,
            amendments: [],
            attachments: payload.attachments || [],
            status: "ACTIVE",
            notes: payload.notes,
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await supplierService.recordLedgerMovement({
        supplierId: payload.supplierId,
        branchId: req.branchContext?.activeBranchId,
        entryType: "CONTRACT_OBLIGATION",
        referenceType: "HOTEL_CONTRACT",
        referenceId: contract!._id,
        referenceNumber: contractNumber,
        description: `Hotel Contract ${contractNumber} (${hotel.nameEn} - ${hotel.city}, ${nights} nights)`,
        creditAmount: calculated.contractValue,
        exchangeRateToEgp: payload.exchangeRateToEgp || 1,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : checkIn,
        actorId: req.user?._id,
        session,
      });

      await auditService.record({
        req,
        action: "HOTEL_CONTRACT_CREATED",
        module: "hotels",
        entityType: "HotelContract",
        entityId: contract!._id.toString(),
        newValues: contract!.toObject(),
        session,
      });

      return contract!;
    });
  }

  async amendHotelContract(contractId: string, payload: any, req: Request) {
    return await withTransaction(async (session) => {
      const contract = await HotelContractModel.findById(contractId, null, session ? { session } : undefined);
      if (!contract) throw new NotFoundException("Hotel contract not found");

      const previousSnapshot = contract.toObject();
      const previousValue = contract.contractValue;

      const nights = payload.nights ?? contract.nights;
      const pricingMode = payload.pricingMode ?? contract.pricingMode;
      const singleRooms = payload.roomCapacities?.singleRooms ?? contract.roomCapacities.singleRooms;
      const doubleRooms = payload.roomCapacities?.doubleRooms ?? contract.roomCapacities.doubleRooms;
      const tripleRooms = payload.roomCapacities?.tripleRooms ?? contract.roomCapacities.tripleRooms;
      const quadRooms = payload.roomCapacities?.quadRooms ?? contract.roomCapacities.quadRooms;

      const calculated = this.calculateHotelContractPricing({
        pricingMode,
        nights,
        singleRooms,
        doubleRooms,
        tripleRooms,
        quadRooms,
        flatRoomRatePerNight: payload.rates?.flatRoomRatePerNight ?? contract.rates.flatRoomRatePerNight,
        singleRoomRatePerNight: payload.rates?.singleRoomRatePerNight ?? contract.rates.singleRoomRatePerNight,
        doubleRoomRatePerNight: payload.rates?.doubleRoomRatePerNight ?? contract.rates.doubleRoomRatePerNight,
        tripleRoomRatePerNight: payload.rates?.tripleRoomRatePerNight ?? contract.rates.tripleRoomRatePerNight,
        quadRoomRatePerNight: payload.rates?.quadRoomRatePerNight ?? contract.rates.quadRoomRatePerNight,
      });

      const deltaValue = Money.subtract(calculated.contractValue, previousValue);

      contract.nights = nights;
      contract.pricingMode = pricingMode;
      contract.roomCapacities = calculated.roomCapacities;
      contract.rates = calculated.rates;
      contract.contractValue = calculated.contractValue;
      contract.remainingLiability = Math.max(0, Money.subtract(calculated.contractValue, contract.paidAmount));
      contract.status = "AMENDED";
      contract.updatedBy = req.user?._id;
      contract.amendments.push({
        amendedAt: new Date(),
        amendedBy: req.user?._id,
        reason: payload.reason || "Contract amendment",
        previousValue,
        newValue: calculated.contractValue,
      });

      await contract.save(session ? { session } : undefined);

      if (deltaValue !== 0) {
        await supplierService.recordLedgerMovement({
          supplierId: contract.supplierId,
          branchId: req.branchContext?.activeBranchId,
          entryType: deltaValue > 0 ? "ADJUSTMENT" : "CREDIT_NOTE",
          referenceType: "HOTEL_CONTRACT",
          referenceId: contract._id,
          referenceNumber: contract.contractNumber,
          description: `Amendment on Hotel Contract ${contract.contractNumber}: ${payload.reason || "Value updated"}`,
          creditAmount: deltaValue > 0 ? deltaValue : 0,
          debitAmount: deltaValue < 0 ? Math.abs(deltaValue) : 0,
          exchangeRateToEgp: payload.exchangeRateToEgp || 1,
          actorId: req.user?._id,
          session,
        });
      }

      await auditService.record({
        req,
        action: "HOTEL_CONTRACT_AMENDED",
        module: "hotels",
        entityType: "HotelContract",
        entityId: contract._id.toString(),
        previousValues: previousSnapshot,
        newValues: contract.toObject(),
        session,
      });

      return contract;
    });
  }
}

export const hotelService = new HotelService();
