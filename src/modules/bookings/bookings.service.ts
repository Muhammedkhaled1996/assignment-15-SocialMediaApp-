import { Request } from "express";
import mongoose from "mongoose";
import {
  BookingModel,
  BookingState,
  BranchModel,
  GroupModel,
  PassengerCategory,
  PassengerModel,
  PricingVersionModel,
  TripModel,
} from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InvalidStateTransitionError,
  NotFoundException,
} from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { assertBranchAccess, resolveScopedBranchFilter } from "../../middleware";
import { UserRole } from "../../common/enum";
import { Money, withTransaction } from "../../common/utils";
import { quotaService } from "../quotas";
import { evaluatePassportValidity } from "../passengers";

const ALLOWED_TRANSITIONS: Record<BookingState, BookingState[]> = {
  DRAFT: ["ON_HOLD", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
  ON_HOLD: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
  PENDING_PAYMENT: ["CONFIRMED", "ON_HOLD", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "REFUNDED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

export function validateBookingStateTransition(from: BookingState, to: BookingState): void {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new InvalidStateTransitionError(`Invalid booking state transition from ${from} to ${to}`);
  }
}

export class BookingRepository extends DatabaseRepository<any> {
  constructor() {
    super(BookingModel);
  }
}

export class BookingService {
  private repo = new BookingRepository();

  /**
   * Creates a new Passenger Booking (Branch POS) with atomic seat reservation and price snapshot locking.
   */
  async createBooking(payload: any, req: Request) {
    const branchId = assertBranchAccess(req.branchContext, payload.branchId);
    const idempotencyKey = payload.idempotencyKey || (req.headers["idempotency-key"] as string | undefined);

    if (idempotencyKey) {
      const existing = await BookingModel.findOne({ idempotencyKey });
      if (existing) return existing;
    }

    return await withTransaction(async (session) => {
      const trip = await TripModel.findById(payload.tripId, null, session ? { session } : undefined);
      if (!trip) throw new NotFoundException("Trip not found");
      if (trip.status !== "OPEN_FOR_BOOKING" && trip.status !== "PUBLISHED") {
        throw new BadRequestException(`Trip is not open for booking (${trip.status})`);
      }

      const passenger = await PassengerModel.findById(payload.passengerId, null, session ? { session } : undefined);
      if (!passenger) throw new NotFoundException("Passenger not found");

      if (!req.branchContext?.isCentralAdmin && passenger.branchId.toString() !== branchId.toString()) {
        throw new ForbiddenException("Cannot book a passenger belonging to another branch");
      }

      const duplicateBooking = await BookingModel.findOne(
        {
          tripId: trip._id,
          passengerId: passenger._id,
          status: { $nin: ["CANCELLED", "REFUNDED"] },
        },
        null,
        session ? { session } : undefined,
      );
      if (duplicateBooking) {
        throw new ConflictException(
          `Passenger already has an active booking (${duplicateBooking.bookingNumber}) on this trip`,
        );
      }

      let passportWarning: string | null = null;
      if (trip.tripCategory !== "DOMESTIC") {
        if (!passenger.passportExpirationDate || !passenger.passportNumber) {
          throw new BadRequestException("Valid passport details are required for religious and outbound international trips");
        }
        const passportEval = evaluatePassportValidity(passenger.passportExpirationDate, trip.departureDate);
        passportWarning = passportEval.warning || null;
      }

      const pricingVersionId = payload.pricingVersionId || trip.approvedPricingVersionId;
      if (!pricingVersionId) {
        throw new BadRequestException("Trip does not have an approved pricing version");
      }

      const pricingVersion = await PricingVersionModel.findById(
        pricingVersionId,
        null,
        session ? { session } : undefined,
      );
      if (!pricingVersion || pricingVersion.status !== "APPROVED") {
        throw new BadRequestException("Approved pricing version is required to create bookings");
      }

      const category: PassengerCategory = payload.passengerCategory || payload.roomType;
      const catPricing = pricingVersion.categories[category];
      if (!catPricing) {
        throw new BadRequestException(`Pricing breakdown for category ${category} not found`);
      }

      const grossAmount = Money.round(catPricing.sellingPriceEgp);
      const discountAmount = Money.round(payload.discountAmount || 0);
      const netSellingPrice = Money.subtract(grossAmount, discountAmount);

      if (
        netSellingPrice < catPricing.minimumSellingPriceEgp &&
        req.user?.roleNumber !== UserRole.SUPER_ADMIN &&
        req.user?.roleNumber !== UserRole.ADMIN
      ) {
        throw new ForbiddenException(
          `Discount reduces selling price (${netSellingPrice} EGP) below approved minimum (${catPricing.minimumSellingPriceEgp} EGP)`,
        );
      }

      const branchDoc = await BranchModel.findById(branchId, "code", session ? { session } : undefined);
      const bookingNumber = await sequenceService.nextReference({
        documentType: "BOOKING",
        branchCode: branchDoc?.code || "BR",
        session,
      });

      const initialStatus: BookingState = payload.status === "DRAFT" ? "DRAFT" : "ON_HOLD";
      let reservationId: mongoose.Types.ObjectId | null = null;
      let holdExpiresAt: Date | null = null;

      if (initialStatus !== "DRAFT") {
        const reservation = await quotaService.reserveSeatsAtomically({
          tripId: trip._id,
          branchId,
          quantity: 1,
          holdMinutes: payload.holdMinutes,
          idempotencyKey: idempotencyKey ? `${idempotencyKey}:RES` : undefined,
          bookingReference: bookingNumber,
          actorId: req.user?._id,
          session,
        });
        reservationId = reservation._id!;
        holdExpiresAt = reservation.expiresAt;
      }

      const [booking] = await BookingModel.create(
        [
          {
            ...(idempotencyKey ? { idempotencyKey } : {}),
            bookingNumber,
            tripId: trip._id,
            groupId: payload.groupId || null,
            passengerId: passenger._id,
            branchId,
            reservationId,
            roomType: payload.roomType,
            passengerCategory: category,
            priceSnapshot: {
              pricingVersionId: pricingVersion._id!,
              pricingVersionCode: pricingVersion.code,
              exchangeRateSarToEgp: pricingVersion.exchangeRateSarToEgp,
              category,
              costPerPassengerEgp: catPricing.totalCostPerPassengerEgp,
              approvedSellingPriceEgp: catPricing.sellingPriceEgp,
              minimumSellingPriceEgp: catPricing.minimumSellingPriceEgp,
            },
            grossAmount,
            discountAmount,
            netSellingPrice,
            amountPaid: 0,
            refundedAmount: 0,
            remainingBalance: netSellingPrice,
            currency: "EGP",
            paymentRecordIds: [],
            status: initialStatus,
            holdExpiresAt,
            passportWarning,
            mahramPassengerId: payload.mahramPassengerId || passenger.mahramPassengerId || null,
            familyGroupCode: (payload.familyGroupCode || passenger.familyGroupCode || "").toUpperCase() || undefined,
            history: [
              {
                fromStatus: null,
                toStatus: initialStatus,
                changedBy: req.user?._id,
                reason: "Booking created",
                timestamp: new Date(),
              },
            ],
            notes: payload.notes,
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      if (payload.groupId) {
        await GroupModel.updateOne(
          { _id: payload.groupId },
          { $inc: { assignedPassengersCount: 1 } },
          session ? { session } : undefined,
        );
      }

      await auditService.record({
        req,
        action: "BOOKING_CREATED",
        module: "bookings",
        entityType: "Booking",
        entityId: booking!._id.toString(),
        branchId,
        newValues: booking!.toObject(),
        session,
      });

      return booking!;
    });
  }

  /**
   * Confirms a booking, validating seat reservation, passport policy, and consuming the reserved seat.
   */
  async confirmBooking(bookingId: string, req: Request) {
    return await withTransaction(async (session) => {
      const filter: Record<string, any> = { _id: bookingId };
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));

      const booking = await BookingModel.findOne(filter, null, session ? { session } : undefined);
      if (!booking) throw new NotFoundException("Booking not found in your branch scope");

      validateBookingStateTransition(booking.status, "CONFIRMED");

      const trip = await TripModel.findById(booking.tripId, null, session ? { session } : undefined);
      if (!trip) throw new NotFoundException("Trip not found");

      const passenger = await PassengerModel.findById(booking.passengerId, null, session ? { session } : undefined);
      if (!passenger) throw new NotFoundException("Passenger not found");

      if (trip.tripCategory !== "DOMESTIC") {
        if (!passenger.passportExpirationDate || !passenger.passportNumber) {
          throw new BadRequestException("Valid passport details are required for religious and outbound international trips");
        }
        evaluatePassportValidity(passenger.passportExpirationDate, trip.departureDate);
      }

      if (!booking.reservationId) {
        const res = await quotaService.reserveSeatsAtomically({
          tripId: booking.tripId,
          branchId: booking.branchId,
          quantity: 1,
          bookingId: booking._id,
          bookingReference: booking.bookingNumber,
          actorId: req.user?._id,
          session,
        });
        booking.reservationId = res._id;
      }

      await quotaService.consumeReservation({
        reservationId: booking.reservationId!,
        actorId: req.user?._id,
        session,
      });

      const prevStatus = booking.status;
      booking.status = "CONFIRMED";
      booking.holdExpiresAt = null;
      booking.confirmedBy = req.user?._id;
      booking.confirmedAt = new Date();
      booking.history.push({
        fromStatus: prevStatus,
        toStatus: "CONFIRMED",
        changedBy: req.user?._id,
        reason: req.body?.reason || "Booking confirmed",
        timestamp: new Date(),
      });

      await booking.save(session ? { session } : undefined);

      await auditService.record({
        req,
        action: "BOOKING_CONFIRMED",
        module: "bookings",
        entityType: "Booking",
        entityId: booking._id.toString(),
        branchId: booking.branchId,
        previousValues: { status: prevStatus },
        newValues: { status: "CONFIRMED" },
        session,
      });

      return booking;
    });
  }

  /**
   * Cancels a booking and releases its held or consumed seat back to inventory, preserving all financial history.
   */
  async cancelBooking(bookingId: string, reason: string, req: Request) {
    return await withTransaction(async (session) => {
      const filter: Record<string, any> = { _id: bookingId };
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));

      const booking = await BookingModel.findOne(filter, null, session ? { session } : undefined);
      if (!booking) throw new NotFoundException("Booking not found in your branch scope");

      validateBookingStateTransition(booking.status, "CANCELLED");

      if (booking.reservationId) {
        await quotaService.releaseReservation({
          reservationId: booking.reservationId,
          reason: "RELEASED",
          actorId: req.user?._id,
          session,
        });
      }

      if (booking.groupId) {
        await GroupModel.updateOne(
          { _id: booking.groupId, assignedPassengersCount: { $gt: 0 } },
          { $inc: { assignedPassengersCount: -1 } },
          session ? { session } : undefined,
        );
      }

      const prevStatus = booking.status;
      booking.status = "CANCELLED";
      booking.cancelledBy = req.user?._id;
      booking.cancelledAt = new Date();
      booking.cancellationReason = reason;
      booking.history.push({
        fromStatus: prevStatus,
        toStatus: "CANCELLED",
        changedBy: req.user?._id,
        reason,
        timestamp: new Date(),
      });

      await booking.save(session ? { session } : undefined);

      await auditService.record({
        req,
        action: "BOOKING_CANCELLED",
        module: "bookings",
        entityType: "Booking",
        entityId: booking._id.toString(),
        branchId: booking.branchId,
        previousValues: { status: prevStatus },
        newValues: { status: "CANCELLED", reason },
        session,
      });

      return booking;
    });
  }

  /**
   * Transfers a booking to another eligible passenger or updates room assignment.
   */
  async updateOrTransferBooking(bookingId: string, payload: any, req: Request) {
    return await withTransaction(async (session) => {
      const filter: Record<string, any> = { _id: bookingId };
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));

      const booking = await BookingModel.findOne(filter, null, session ? { session } : undefined);
      if (!booking) throw new NotFoundException("Booking not found");
      const prev = booking.toObject();

      if (payload.newPassengerId && payload.newPassengerId !== booking.passengerId.toString()) {
        const newPassenger = await PassengerModel.findById(
          payload.newPassengerId,
          null,
          session ? { session } : undefined,
        );
        if (!newPassenger) throw new NotFoundException("Target passenger not found");
        const trip = await TripModel.findById(booking.tripId, null, session ? { session } : undefined);
        if (trip && trip.tripCategory !== "DOMESTIC") {
          if (!newPassenger.passportExpirationDate || !newPassenger.passportNumber) {
            throw new BadRequestException("Valid passport details are required for religious and outbound international trips");
          }
          evaluatePassportValidity(newPassenger.passportExpirationDate, trip.departureDate);
        }
        booking.passengerId = newPassenger._id!;
      }

      if (payload.roomType !== undefined) booking.roomType = payload.roomType;
      if (payload.familyGroupCode !== undefined) booking.familyGroupCode = payload.familyGroupCode?.toUpperCase();
      if (payload.mahramPassengerId !== undefined) booking.mahramPassengerId = payload.mahramPassengerId;
      if (payload.groupId !== undefined) booking.groupId = payload.groupId;
      if (payload.notes !== undefined) booking.notes = payload.notes;

      await booking.save(session ? { session } : undefined);

      await auditService.record({
        req,
        action: "BOOKING_UPDATED",
        module: "bookings",
        entityType: "Booking",
        entityId: booking._id.toString(),
        branchId: booking.branchId,
        previousValues: prev,
        newValues: booking.toObject(),
        session,
      });

      return booking;
    });
  }
}

export const bookingService = new BookingService();
