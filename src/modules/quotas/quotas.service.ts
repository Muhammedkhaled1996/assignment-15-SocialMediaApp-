import { Request } from "express";
import mongoose, { ClientSession } from "mongoose";
import {
  BranchQuotaModel,
  InventoryMovementModel,
  InventoryReservationModel,
  TripModel,
} from "../../DB/module";
import {
  BadRequestException,
  InsufficientInventoryError,
  NotFoundException,
} from "../../common/exception";
import { auditService } from "../../common/service";
import { withTransaction } from "../../common/utils";
import { BOOKING_HOLD_DEFAULT_MINUTES } from "../../config";

export class QuotaService {
  /**
   * Allocates seats from the Trip's available inventory to a specific Branch (for ALLOCATED_QUOTA mode).
   * Uses atomic conditional `$gte` updates to guarantee no negative inventory under concurrent requests.
   */
  async allocateToBranch({
    tripId,
    branchId,
    quantity,
    notes,
    req,
  }: {
    tripId: string;
    branchId: string;
    quantity: number;
    notes?: string;
    req: Request;
  }) {
    const qty = Math.floor(quantity);
    if (qty < 1) throw new BadRequestException("Allocation quantity must be at least 1");

    return await withTransaction(async (session) => {
      const trip = await TripModel.findOneAndUpdate(
        {
          _id: tripId,
          availableInventory: { $gte: qty },
        },
        {
          $inc: {
            availableInventory: -qty,
            allocatedToBranchesSeats: qty,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!trip) {
        throw new InsufficientInventoryError(
          `Insufficient available trip inventory to allocate ${qty} seats to branch`,
        );
      }

      const branchQuota = await BranchQuotaModel.findOneAndUpdate(
        { tripId, branchId },
        {
          $inc: {
            allocatedSeats: qty,
            availableSeats: qty,
          },
          $setOnInsert: {
            reservedSeats: 0,
            consumedSeats: 0,
            status: "ACTIVE",
          },
          $set: { updatedBy: req.user?._id },
        },
        { upsert: true, returnDocument: "after", ...(session ? { session } : {}) },
      );

      await InventoryMovementModel.create(
        [
          {
            tripId: trip._id,
            branchId: new mongoose.Types.ObjectId(branchId),
            action: "ALLOCATE_BRANCH",
            quantity: qty,
            notes: notes || `Allocated ${qty} seats to branch`,
            actorId: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await auditService.record({
        req,
        action: "QUOTA_ALLOCATED_TO_BRANCH",
        module: "quotas",
        entityType: "BranchQuota",
        entityId: branchQuota!._id.toString(),
        branchId,
        newValues: branchQuota!.toObject(),
        session,
      });

      return { trip, branchQuota: branchQuota! };
    });
  }

  /**
   * Transfers allocated seats atomically from one branch to another.
   */
  async transferBetweenBranches({
    tripId,
    fromBranchId,
    toBranchId,
    quantity,
    notes,
    req,
  }: {
    tripId: string;
    fromBranchId: string;
    toBranchId: string;
    quantity: number;
    notes?: string;
    req: Request;
  }) {
    if (fromBranchId === toBranchId) {
      throw new BadRequestException("Source and destination branches must be different");
    }
    const qty = Math.floor(quantity);
    if (qty < 1) throw new BadRequestException("Transfer quantity must be at least 1");

    return await withTransaction(async (session) => {
      const sourceQuota = await BranchQuotaModel.findOneAndUpdate(
        {
          tripId,
          branchId: fromBranchId,
          availableSeats: { $gte: qty },
        },
        {
          $inc: {
            allocatedSeats: -qty,
            availableSeats: -qty,
          },
          $set: { updatedBy: req.user?._id },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!sourceQuota) {
        throw new InsufficientInventoryError("Source branch does not have enough available seats to transfer");
      }

      const targetQuota = await BranchQuotaModel.findOneAndUpdate(
        { tripId, branchId: toBranchId },
        {
          $inc: {
            allocatedSeats: qty,
            availableSeats: qty,
          },
          $setOnInsert: {
            reservedSeats: 0,
            consumedSeats: 0,
            status: "ACTIVE",
          },
          $set: { updatedBy: req.user?._id },
        },
        { upsert: true, returnDocument: "after", ...(session ? { session } : {}) },
      );

      await InventoryMovementModel.create(
        [
          {
            tripId: new mongoose.Types.ObjectId(tripId),
            branchId: new mongoose.Types.ObjectId(fromBranchId),
            targetBranchId: new mongoose.Types.ObjectId(toBranchId),
            action: "TRANSFER_BRANCH",
            quantity: qty,
            notes: notes || `Transferred ${qty} seats between branches`,
            actorId: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await auditService.record({
        req,
        action: "QUOTA_TRANSFERRED",
        module: "quotas",
        entityType: "BranchQuota",
        entityId: sourceQuota._id.toString(),
        branchId: fromBranchId,
        newValues: { fromBranchId, toBranchId, quantity: qty },
        session,
      });

      return { sourceQuota, targetQuota: targetQuota! };
    });
  }

  /**
   * Releases unused branch quota back to the Trip's shared available inventory.
   */
  async releaseFromBranch({
    tripId,
    branchId,
    quantity,
    notes,
    req,
  }: {
    tripId: string;
    branchId: string;
    quantity: number;
    notes?: string;
    req: Request;
  }) {
    const qty = Math.floor(quantity);
    if (qty < 1) throw new BadRequestException("Release quantity must be at least 1");

    return await withTransaction(async (session) => {
      const branchQuota = await BranchQuotaModel.findOneAndUpdate(
        {
          tripId,
          branchId,
          availableSeats: { $gte: qty },
        },
        {
          $inc: {
            allocatedSeats: -qty,
            availableSeats: -qty,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!branchQuota) {
        throw new InsufficientInventoryError("Branch does not have enough available unreserved seats to release");
      }

      const trip = await TripModel.findOneAndUpdate(
        { _id: tripId },
        {
          $inc: {
            availableInventory: qty,
            allocatedToBranchesSeats: -qty,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      await InventoryMovementModel.create(
        [
          {
            tripId: new mongoose.Types.ObjectId(tripId),
            branchId: new mongoose.Types.ObjectId(branchId),
            action: "RELEASE_BRANCH",
            quantity: qty,
            notes: notes || `Released ${qty} seats from branch back to central pool`,
            actorId: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      await auditService.record({
        req,
        action: "QUOTA_RELEASED_FROM_BRANCH",
        module: "quotas",
        entityType: "BranchQuota",
        entityId: branchQuota._id.toString(),
        branchId,
        newValues: branchQuota.toObject(),
        session,
      });

      return { trip, branchQuota };
    });
  }

  /**
   * Concurrency-Safe Atomic Seat Reservation.
   */
  async reserveSeatsAtomically({
    tripId,
    branchId,
    quantity = 1,
    holdMinutes = BOOKING_HOLD_DEFAULT_MINUTES,
    idempotencyKey,
    bookingId,
    bookingReference,
    actorId,
    session,
  }: {
    tripId: string | mongoose.Types.ObjectId;
    branchId: string | mongoose.Types.ObjectId;
    quantity?: number;
    holdMinutes?: number;
    idempotencyKey?: string | undefined;
    bookingId?: string | mongoose.Types.ObjectId | undefined;
    bookingReference?: string | undefined;
    actorId?: string | mongoose.Types.ObjectId | undefined;
    session?: ClientSession | undefined;
  }) {
    const qty = Math.floor(quantity);
    if (qty < 1) throw new BadRequestException("Reservation quantity must be at least 1");

    if (idempotencyKey) {
      const existingRes = await InventoryReservationModel.findOne(
        { idempotencyKey },
        null,
        session ? { session } : undefined,
      );
      if (existingRes) {
        return existingRes;
      }
    }

    const tripMeta = await TripModel.findById(tripId, "quotaMode status", session ? { session } : undefined);
    if (!tripMeta) {
      throw new NotFoundException("Trip not found");
    }
    if (tripMeta.status !== "OPEN_FOR_BOOKING" && tripMeta.status !== "PUBLISHED") {
      throw new BadRequestException(`Trip is not open for booking (current status: ${tripMeta.status})`);
    }

    let quotaSource: "SHARED" | "BRANCH_ALLOCATED" = "SHARED";

    if (tripMeta.quotaMode === "ALLOCATED_QUOTA") {
      quotaSource = "BRANCH_ALLOCATED";
      const updatedBranchQuota = await BranchQuotaModel.findOneAndUpdate(
        {
          tripId: new mongoose.Types.ObjectId(tripId.toString()),
          branchId: new mongoose.Types.ObjectId(branchId.toString()),
          status: "ACTIVE",
          availableSeats: { $gte: qty },
        },
        {
          $inc: {
            availableSeats: -qty,
            reservedSeats: qty,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!updatedBranchQuota) {
        throw new InsufficientInventoryError("Insufficient available branch quota for this trip");
      }

      await TripModel.updateOne(
        { _id: tripId },
        { $inc: { reservedSeats: qty } },
        session ? { session } : undefined,
      );
    } else {
      const updatedTrip = await TripModel.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(tripId.toString()),
          availableInventory: { $gte: qty },
        },
        {
          $inc: {
            availableInventory: -qty,
            reservedSeats: qty,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!updatedTrip) {
        throw new InsufficientInventoryError("Insufficient available seats in trip inventory");
      }
    }

    const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
    const [reservation] = await InventoryReservationModel.create(
      [
        {
          ...(idempotencyKey ? { idempotencyKey } : {}),
          tripId: new mongoose.Types.ObjectId(tripId.toString()),
          branchId: new mongoose.Types.ObjectId(branchId.toString()),
          bookingId: bookingId ? new mongoose.Types.ObjectId(bookingId.toString()) : null,
          bookingReference,
          quantity: qty,
          quotaSource,
          expiresAt,
          status: "ACTIVE_HOLD",
          createdBy: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : undefined,
        },
      ],
      session ? { session } : undefined,
    );

    await InventoryMovementModel.create(
      [
        {
          tripId: new mongoose.Types.ObjectId(tripId.toString()),
          branchId: new mongoose.Types.ObjectId(branchId.toString()),
          action: "RESERVE_SEATS",
          quantity: qty,
          referenceId: bookingReference || reservation!._id.toString(),
          notes: `Reserved ${qty} seat(s) (${quotaSource})`,
          actorId: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : undefined,
        },
      ],
      session ? { session } : undefined,
    );

    return reservation!;
  }

  /**
   * Transitions an active seat reservation (`ACTIVE_HOLD`) to permanently consumed (`CONSUMED`) upon booking confirmation.
   */
  async consumeReservation({
    reservationId,
    actorId,
    session,
  }: {
    reservationId: string | mongoose.Types.ObjectId;
    actorId?: string | mongoose.Types.ObjectId | undefined;
    session?: ClientSession | undefined;
  }) {
    const reservation = await InventoryReservationModel.findOneAndUpdate(
      {
        _id: reservationId,
        status: "ACTIVE_HOLD",
      },
      {
        $set: { status: "CONSUMED" },
      },
      { returnDocument: "after", ...(session ? { session } : {}) },
    );

    if (!reservation) {
      throw new InsufficientInventoryError("Active seat reservation not found or has already expired");
    }

    if (reservation.quotaSource === "BRANCH_ALLOCATED") {
      await BranchQuotaModel.updateOne(
        { tripId: reservation.tripId, branchId: reservation.branchId },
        {
          $inc: {
            reservedSeats: -reservation.quantity,
            consumedSeats: reservation.quantity,
          },
        },
        session ? { session } : undefined,
      );
    }

    await TripModel.updateOne(
      { _id: reservation.tripId },
      {
        $inc: {
          reservedSeats: -reservation.quantity,
          confirmedSoldSeats: reservation.quantity,
        },
      },
      session ? { session } : undefined,
    );

    await InventoryMovementModel.create(
      [
        {
          tripId: reservation.tripId,
          branchId: reservation.branchId,
          action: "CONSUME_SEATS",
          quantity: reservation.quantity,
          referenceId: reservation.bookingReference || reservation._id.toString(),
          notes: `Consumed ${reservation.quantity} seat(s) on confirmation`,
          actorId: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : undefined,
        },
      ],
      session ? { session } : undefined,
    );

    return reservation;
  }

  /**
   * Releases an active or consumed seat reservation back to available inventory (e.g., on cancellation or hold expiration).
   */
  async releaseReservation({
    reservationId,
    reason = "RELEASED",
    actorId,
    session,
  }: {
    reservationId: string | mongoose.Types.ObjectId;
    reason?: "RELEASED" | "EXPIRED";
    actorId?: string | mongoose.Types.ObjectId | undefined;
    session?: ClientSession | undefined;
  }) {
    const reservation = await InventoryReservationModel.findById(
      reservationId,
      null,
      session ? { session } : undefined,
    );
    if (!reservation || reservation.status === "RELEASED" || reservation.status === "EXPIRED") {
      return reservation;
    }

    const prevStatus = reservation.status;
    reservation.status = reason;
    await reservation.save(session ? { session } : undefined);

    const qty = reservation.quantity;

    if (reservation.quotaSource === "BRANCH_ALLOCATED") {
      await BranchQuotaModel.updateOne(
        { tripId: reservation.tripId, branchId: reservation.branchId },
        {
          $inc: {
            availableSeats: qty,
            ...(prevStatus === "ACTIVE_HOLD" ? { reservedSeats: -qty } : {}),
            ...(prevStatus === "CONSUMED" ? { consumedSeats: -qty } : {}),
          },
        },
        session ? { session } : undefined,
      );

      await TripModel.updateOne(
        { _id: reservation.tripId },
        {
          $inc: {
            ...(prevStatus === "ACTIVE_HOLD" ? { reservedSeats: -qty } : {}),
            ...(prevStatus === "CONSUMED" ? { confirmedSoldSeats: -qty } : {}),
          },
        },
        session ? { session } : undefined,
      );
    } else {
      await TripModel.updateOne(
        { _id: reservation.tripId },
        {
          $inc: {
            availableInventory: qty,
            ...(prevStatus === "ACTIVE_HOLD" ? { reservedSeats: -qty } : {}),
            ...(prevStatus === "CONSUMED" ? { confirmedSoldSeats: -qty } : {}),
          },
        },
        session ? { session } : undefined,
      );
    }

    await InventoryMovementModel.create(
      [
        {
          tripId: reservation.tripId,
          branchId: reservation.branchId,
          action: reason === "EXPIRED" ? "EXPIRE_RESERVATION" : "RELEASE_RESERVATION",
          quantity: qty,
          referenceId: reservation.bookingReference || reservation._id.toString(),
          notes: `Released ${qty} seat(s) from ${prevStatus} (${reason})`,
          actorId: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : undefined,
        },
      ],
      session ? { session } : undefined,
    );

    return reservation;
  }
}

export const quotaService = new QuotaService();
