"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingService = exports.BookingService = exports.BookingRepository = void 0;
exports.validateBookingStateTransition = validateBookingStateTransition;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const utils_1 = require("../../common/utils");
const quotas_1 = require("../quotas");
const passengers_1 = require("../passengers");
const ALLOWED_TRANSITIONS = {
    DRAFT: ["ON_HOLD", "PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
    ON_HOLD: ["PENDING_PAYMENT", "CONFIRMED", "CANCELLED"],
    PENDING_PAYMENT: ["CONFIRMED", "ON_HOLD", "CANCELLED"],
    CONFIRMED: ["COMPLETED", "CANCELLED", "REFUNDED"],
    COMPLETED: ["REFUNDED"],
    CANCELLED: ["REFUNDED"],
    REFUNDED: [],
};
function validateBookingStateTransition(from, to) {
    if (from === to)
        return;
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
        throw new exception_1.InvalidStateTransitionError(`Invalid booking state transition from ${from} to ${to}`);
    }
}
class BookingRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.BookingModel);
    }
}
exports.BookingRepository = BookingRepository;
class BookingService {
    repo = new BookingRepository();
    async createBooking(payload, req) {
        const branchId = (0, middleware_1.assertBranchAccess)(req.branchContext, payload.branchId);
        const idempotencyKey = payload.idempotencyKey || req.headers["idempotency-key"];
        if (idempotencyKey) {
            const existing = await module_1.BookingModel.findOne({ idempotencyKey });
            if (existing)
                return existing;
        }
        return await (0, utils_1.withTransaction)(async (session) => {
            const trip = await module_1.TripModel.findById(payload.tripId, null, session ? { session } : undefined);
            if (!trip)
                throw new exception_1.NotFoundException("Trip not found");
            if (trip.status !== "OPEN_FOR_BOOKING" && trip.status !== "PUBLISHED") {
                throw new exception_1.BadRequestException(`Trip is not open for booking (${trip.status})`);
            }
            const passenger = await module_1.PassengerModel.findById(payload.passengerId, null, session ? { session } : undefined);
            if (!passenger)
                throw new exception_1.NotFoundException("Passenger not found");
            if (!req.branchContext?.isCentralAdmin && passenger.branchId.toString() !== branchId.toString()) {
                throw new exception_1.ForbiddenException("Cannot book a passenger belonging to another branch");
            }
            const duplicateBooking = await module_1.BookingModel.findOne({
                tripId: trip._id,
                passengerId: passenger._id,
                status: { $nin: ["CANCELLED", "REFUNDED"] },
            }, null, session ? { session } : undefined);
            if (duplicateBooking) {
                throw new exception_1.ConflictException(`Passenger already has an active booking (${duplicateBooking.bookingNumber}) on this trip`);
            }
            let passportWarning = null;
            if (trip.tripCategory !== "DOMESTIC") {
                if (!passenger.passportExpirationDate || !passenger.passportNumber) {
                    throw new exception_1.BadRequestException("Valid passport details are required for religious and outbound international trips");
                }
                const passportEval = (0, passengers_1.evaluatePassportValidity)(passenger.passportExpirationDate, trip.departureDate);
                passportWarning = passportEval.warning || null;
            }
            const pricingVersionId = payload.pricingVersionId || trip.approvedPricingVersionId;
            if (!pricingVersionId) {
                throw new exception_1.BadRequestException("Trip does not have an approved pricing version");
            }
            const pricingVersion = await module_1.PricingVersionModel.findById(pricingVersionId, null, session ? { session } : undefined);
            if (!pricingVersion || pricingVersion.status !== "APPROVED") {
                throw new exception_1.BadRequestException("Approved pricing version is required to create bookings");
            }
            const category = payload.passengerCategory || payload.roomType;
            const catPricing = pricingVersion.categories[category];
            if (!catPricing) {
                throw new exception_1.BadRequestException(`Pricing breakdown for category ${category} not found`);
            }
            const grossAmount = utils_1.Money.round(catPricing.sellingPriceEgp);
            const discountAmount = utils_1.Money.round(payload.discountAmount || 0);
            const netSellingPrice = utils_1.Money.subtract(grossAmount, discountAmount);
            if (netSellingPrice < catPricing.minimumSellingPriceEgp &&
                req.user?.roleNumber !== enum_1.UserRole.SUPER_ADMIN &&
                req.user?.roleNumber !== enum_1.UserRole.ADMIN) {
                throw new exception_1.ForbiddenException(`Discount reduces selling price (${netSellingPrice} EGP) below approved minimum (${catPricing.minimumSellingPriceEgp} EGP)`);
            }
            const branchDoc = await module_1.BranchModel.findById(branchId, "code", session ? { session } : undefined);
            const bookingNumber = await service_1.sequenceService.nextReference({
                documentType: "BOOKING",
                branchCode: branchDoc?.code || "BR",
                session,
            });
            const initialStatus = payload.status === "DRAFT" ? "DRAFT" : "ON_HOLD";
            let reservationId = null;
            let holdExpiresAt = null;
            if (initialStatus !== "DRAFT") {
                const reservation = await quotas_1.quotaService.reserveSeatsAtomically({
                    tripId: trip._id,
                    branchId,
                    quantity: 1,
                    holdMinutes: payload.holdMinutes,
                    idempotencyKey: idempotencyKey ? `${idempotencyKey}:RES` : undefined,
                    bookingReference: bookingNumber,
                    actorId: req.user?._id,
                    session,
                });
                reservationId = reservation._id;
                holdExpiresAt = reservation.expiresAt;
            }
            const [booking] = await module_1.BookingModel.create([
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
                        pricingVersionId: pricingVersion._id,
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
            ], session ? { session } : undefined);
            if (payload.groupId) {
                await module_1.GroupModel.updateOne({ _id: payload.groupId }, { $inc: { assignedPassengersCount: 1 } }, session ? { session } : undefined);
            }
            await service_1.auditService.record({
                req,
                action: "BOOKING_CREATED",
                module: "bookings",
                entityType: "Booking",
                entityId: booking._id.toString(),
                branchId,
                newValues: booking.toObject(),
                session,
            });
            return booking;
        });
    }
    async confirmBooking(bookingId, req) {
        return await (0, utils_1.withTransaction)(async (session) => {
            const filter = { _id: bookingId };
            Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
            const booking = await module_1.BookingModel.findOne(filter, null, session ? { session } : undefined);
            if (!booking)
                throw new exception_1.NotFoundException("Booking not found in your branch scope");
            validateBookingStateTransition(booking.status, "CONFIRMED");
            const trip = await module_1.TripModel.findById(booking.tripId, null, session ? { session } : undefined);
            if (!trip)
                throw new exception_1.NotFoundException("Trip not found");
            const passenger = await module_1.PassengerModel.findById(booking.passengerId, null, session ? { session } : undefined);
            if (!passenger)
                throw new exception_1.NotFoundException("Passenger not found");
            if (trip.tripCategory !== "DOMESTIC") {
                if (!passenger.passportExpirationDate || !passenger.passportNumber) {
                    throw new exception_1.BadRequestException("Valid passport details are required for religious and outbound international trips");
                }
                (0, passengers_1.evaluatePassportValidity)(passenger.passportExpirationDate, trip.departureDate);
            }
            if (!booking.reservationId) {
                const res = await quotas_1.quotaService.reserveSeatsAtomically({
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
            await quotas_1.quotaService.consumeReservation({
                reservationId: booking.reservationId,
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
            await service_1.auditService.record({
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
    async cancelBooking(bookingId, reason, req) {
        return await (0, utils_1.withTransaction)(async (session) => {
            const filter = { _id: bookingId };
            Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
            const booking = await module_1.BookingModel.findOne(filter, null, session ? { session } : undefined);
            if (!booking)
                throw new exception_1.NotFoundException("Booking not found in your branch scope");
            validateBookingStateTransition(booking.status, "CANCELLED");
            if (booking.reservationId) {
                await quotas_1.quotaService.releaseReservation({
                    reservationId: booking.reservationId,
                    reason: "RELEASED",
                    actorId: req.user?._id,
                    session,
                });
            }
            if (booking.groupId) {
                await module_1.GroupModel.updateOne({ _id: booking.groupId, assignedPassengersCount: { $gt: 0 } }, { $inc: { assignedPassengersCount: -1 } }, session ? { session } : undefined);
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
            await service_1.auditService.record({
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
    async updateOrTransferBooking(bookingId, payload, req) {
        return await (0, utils_1.withTransaction)(async (session) => {
            const filter = { _id: bookingId };
            Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
            const booking = await module_1.BookingModel.findOne(filter, null, session ? { session } : undefined);
            if (!booking)
                throw new exception_1.NotFoundException("Booking not found");
            const prev = booking.toObject();
            if (payload.newPassengerId && payload.newPassengerId !== booking.passengerId.toString()) {
                const newPassenger = await module_1.PassengerModel.findById(payload.newPassengerId, null, session ? { session } : undefined);
                if (!newPassenger)
                    throw new exception_1.NotFoundException("Target passenger not found");
                const trip = await module_1.TripModel.findById(booking.tripId, null, session ? { session } : undefined);
                if (trip && trip.tripCategory !== "DOMESTIC") {
                    if (!newPassenger.passportExpirationDate || !newPassenger.passportNumber) {
                        throw new exception_1.BadRequestException("Valid passport details are required for religious and outbound international trips");
                    }
                    (0, passengers_1.evaluatePassportValidity)(newPassenger.passportExpirationDate, trip.departureDate);
                }
                booking.passengerId = newPassenger._id;
            }
            if (payload.roomType !== undefined)
                booking.roomType = payload.roomType;
            if (payload.familyGroupCode !== undefined)
                booking.familyGroupCode = payload.familyGroupCode?.toUpperCase();
            if (payload.mahramPassengerId !== undefined)
                booking.mahramPassengerId = payload.mahramPassengerId;
            if (payload.groupId !== undefined)
                booking.groupId = payload.groupId;
            if (payload.notes !== undefined)
                booking.notes = payload.notes;
            await booking.save(session ? { session } : undefined);
            await service_1.auditService.record({
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
exports.BookingService = BookingService;
exports.bookingService = new BookingService();
