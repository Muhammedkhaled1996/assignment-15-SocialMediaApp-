import { Request } from "express";
import {
  InventoryMovementModel,
  TripModel,
  WholesaleContractModel,
  WholesalePartnerModel,
} from "../../DB/module";
import {
  BadRequestException,
  ConflictException,
  InsufficientInventoryError,
  NotFoundException,
} from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { assertBranchAccess } from "../../middleware";
import { Money, withTransaction } from "../../common/utils";

export class WholesaleService {
  async createPartner(payload: any, req: Request) {
    const code = payload.code.toUpperCase().trim();
    const exists = await WholesalePartnerModel.findOne({ code });
    if (exists) throw new ConflictException(`Wholesale partner ${code} already exists`);

    const partner = await WholesalePartnerModel.create({
      ...payload,
      code,
      createdBy: req.user?._id,
    });

    await auditService.record({
      req,
      action: "WHOLESALE_PARTNER_CREATED",
      module: "wholesale",
      entityType: "WholesalePartner",
      entityId: partner._id.toString(),
      newValues: partner.toObject(),
    });

    return partner;
  }

  /**
   * Creates a wholesale contract (block seat allocation or entire trip sale) and atomically locks
   * the allocated seats from `Trip.availableInventory`, preventing retail bookings from consuming them.
   */
  async createWholesaleContract(payload: any, req: Request) {
    const branchId = assertBranchAccess(req.branchContext, payload.branchId);

    return await withTransaction(async (session) => {
      const partner = await WholesalePartnerModel.findById(payload.partnerId, null, session ? { session } : undefined);
      if (!partner) throw new NotFoundException("Wholesale partner not found");

      const tripInfo = await TripModel.findById(payload.tripId, null, session ? { session } : undefined);
      if (!tripInfo) throw new NotFoundException("Trip not found");

      const seatQuantity =
        payload.allocationType === "ENTIRE_TRIP" ? tripInfo.availableInventory : Math.floor(payload.seatQuantity);

      if (seatQuantity < 1) {
        throw new BadRequestException("Wholesale seat quantity must be at least 1");
      }

      const updatedTrip = await TripModel.findOneAndUpdate(
        {
          _id: tripInfo._id,
          availableInventory: { $gte: seatQuantity },
        },
        {
          $inc: {
            availableInventory: -seatQuantity,
            wholesaleAllocatedSeats: seatQuantity,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!updatedTrip) {
        throw new InsufficientInventoryError(
          `Insufficient available trip inventory (${tripInfo.availableInventory}) for wholesale allocation of ${seatQuantity} seats`,
        );
      }

      const unitPriceEgp = Money.round(payload.unitPriceEgp);
      const totalContractPriceEgp = Money.multiply(unitPriceEgp, seatQuantity);
      const depositAmountEgp = Money.round(payload.depositAmountEgp || 0);

      const contractNumber =
        payload.contractNumber?.toUpperCase().trim() ||
        (await sequenceService.nextReference({
          documentType: "WHOLESALE",
          prefix: "WSL",
          session,
        }));

      const [contract] = await WholesaleContractModel.create(
        [
          {
            contractNumber,
            partnerId: partner._id,
            tripId: updatedTrip._id,
            branchId,
            allocationType: payload.allocationType || "SEAT_BLOCK",
            seatQuantity,
            releasedSeats: 0,
            unitPriceEgp,
            totalContractPriceEgp,
            depositAmountEgp,
            paidAmountEgp: 0,
            remainingBalanceEgp: totalContractPriceEgp,
            paymentSchedule: payload.paymentSchedule || [],
            attachments: payload.attachments || [],
            status: "ACTIVE",
            notes: payload.notes,
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      partner.totalContractedAmount = Money.add(partner.totalContractedAmount, totalContractPriceEgp);
      partner.currentBalance = Money.subtract(partner.totalContractedAmount, partner.totalPaidAmount);
      await partner.save(session ? { session } : undefined);

      await InventoryMovementModel.create(
        [
          {
            tripId: updatedTrip._id,
            branchId,
            action: "WHOLESALE_ALLOCATE",
            quantity: seatQuantity,
            referenceId: contractNumber,
            notes: `Wholesale allocation (${contractNumber}) to ${partner.companyNameEn}`,
            actorId: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await auditService.record({
        req,
        action: "WHOLESALE_CONTRACT_CREATED",
        module: "wholesale",
        entityType: "WholesaleContract",
        entityId: contract!._id.toString(),
        branchId,
        newValues: contract!.toObject(),
        session,
      });

      return contract!;
    });
  }

  /**
   * Releases seats from a wholesale contract back into the Trip's retail `availableInventory`.
   */
  async releaseWholesaleSeats(contractId: string, quantityToRelease: number, req: Request) {
    const qty = Math.floor(quantityToRelease);
    if (qty < 1) throw new BadRequestException("Quantity to release must be at least 1");

    return await withTransaction(async (session) => {
      const contract = await WholesaleContractModel.findById(contractId, null, session ? { session } : undefined);
      if (!contract) throw new NotFoundException("Wholesale contract not found");

      const activeLocked = contract.seatQuantity - contract.releasedSeats;
      if (qty > activeLocked) {
        throw new BadRequestException(`Cannot release ${qty} seats; only ${activeLocked} seats are currently locked`);
      }

      const partner = await WholesalePartnerModel.findById(contract.partnerId, null, session ? { session } : undefined);

      const reductionAmount = Money.multiply(contract.unitPriceEgp, qty);
      contract.releasedSeats += qty;
      contract.totalContractPriceEgp = Money.subtract(contract.totalContractPriceEgp, reductionAmount);
      contract.remainingBalanceEgp = Math.max(0, Money.subtract(contract.totalContractPriceEgp, contract.paidAmountEgp));
      contract.status = contract.releasedSeats === contract.seatQuantity ? "CANCELLED" : "PARTIALLY_RELEASED";
      await contract.save(session ? { session } : undefined);

      if (partner) {
        partner.totalContractedAmount = Math.max(0, Money.subtract(partner.totalContractedAmount, reductionAmount));
        partner.currentBalance = Math.max(0, Money.subtract(partner.totalContractedAmount, partner.totalPaidAmount));
        await partner.save(session ? { session } : undefined);
      }

      await TripModel.updateOne(
        { _id: contract.tripId },
        {
          $inc: {
            availableInventory: qty,
            wholesaleAllocatedSeats: -qty,
          },
        },
        session ? { session } : undefined,
      );

      await InventoryMovementModel.create(
        [
          {
            tripId: contract.tripId,
            branchId: contract.branchId,
            action: "WHOLESALE_RELEASE",
            quantity: qty,
            referenceId: contract.contractNumber,
            notes: `Released ${qty} wholesale seats back to retail inventory`,
            actorId: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await auditService.record({
        req,
        action: "WHOLESALE_SEATS_RELEASED",
        module: "wholesale",
        entityType: "WholesaleContract",
        entityId: contract._id.toString(),
        branchId: contract.branchId,
        newValues: contract.toObject(),
        session,
      });

      return contract;
    });
  }
}

export const wholesaleService = new WholesaleService();
