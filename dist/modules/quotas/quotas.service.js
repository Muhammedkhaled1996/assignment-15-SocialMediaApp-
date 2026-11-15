"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotaService = exports.QuotaService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
const config_1 = require("../../config");
class QuotaService {
    async allocateToBranch({ tripId, branchId, quantity, notes, req, }) {
        const qty = Math.floor(quantity);
        if (qty < 1)
            throw new exception_1.BadRequestException("Allocation quantity must be at least 1");
        return await (0, utils_1.withTransaction)(async (session) => {
            const trip = await module_1.TripModel.findOneAndUpdate({
                _id: tripId,
                availableInventory: { $gte: qty },
            }, {
                $inc: {
                    availableInventory: -qty,
                    allocatedToBranchesSeats: qty,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!trip) {
                throw new exception_1.InsufficientInventoryError(`Insufficient available trip inventory to allocate ${qty} seats to branch`);
            }
            const branchQuota = await module_1.BranchQuotaModel.findOneAndUpdate({ tripId, branchId }, {
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
            }, { upsert: true, returnDocument: "after", ...(session ? { session } : {}) });
            await module_1.InventoryMovementModel.create([
                {
                    tripId: trip._id,
                    branchId: new mongoose_1.default.Types.ObjectId(branchId),
                    action: "ALLOCATE_BRANCH",
                    quantity: qty,
                    notes: notes || `Allocated ${qty} seats to branch`,
                    actorId: req.user?._id,
                },
            ], session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "QUOTA_ALLOCATED_TO_BRANCH",
                module: "quotas",
                entityType: "BranchQuota",
                entityId: branchQuota._id.toString(),
                branchId,
                newValues: branchQuota.toObject(),
                session,
            });
            return { trip, branchQuota: branchQuota };
        });
    }
    async transferBetweenBranches({ tripId, fromBranchId, toBranchId, quantity, notes, req, }) {
        if (fromBranchId === toBranchId) {
            throw new exception_1.BadRequestException("Source and destination branches must be different");
        }
        const qty = Math.floor(quantity);
        if (qty < 1)
            throw new exception_1.BadRequestException("Transfer quantity must be at least 1");
        return await (0, utils_1.withTransaction)(async (session) => {
            const sourceQuota = await module_1.BranchQuotaModel.findOneAndUpdate({
                tripId,
                branchId: fromBranchId,
                availableSeats: { $gte: qty },
            }, {
                $inc: {
                    allocatedSeats: -qty,
                    availableSeats: -qty,
                },
                $set: { updatedBy: req.user?._id },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!sourceQuota) {
                throw new exception_1.InsufficientInventoryError("Source branch does not have enough available seats to transfer");
            }
            const targetQuota = await module_1.BranchQuotaModel.findOneAndUpdate({ tripId, branchId: toBranchId }, {
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
            }, { upsert: true, returnDocument: "after", ...(session ? { session } : {}) });
            await module_1.InventoryMovementModel.create([
                {
                    tripId: new mongoose_1.default.Types.ObjectId(tripId),
                    branchId: new mongoose_1.default.Types.ObjectId(fromBranchId),
                    targetBranchId: new mongoose_1.default.Types.ObjectId(toBranchId),
                    action: "TRANSFER_BRANCH",
                    quantity: qty,
                    notes: notes || `Transferred ${qty} seats between branches`,
                    actorId: req.user?._id,
                },
            ], session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "QUOTA_TRANSFERRED",
                module: "quotas",
                entityType: "BranchQuota",
                entityId: sourceQuota._id.toString(),
                branchId: fromBranchId,
                newValues: { fromBranchId, toBranchId, quantity: qty },
                session,
            });
            return { sourceQuota, targetQuota: targetQuota };
        });
    }
    async releaseFromBranch({ tripId, branchId, quantity, notes, req, }) {
        const qty = Math.floor(quantity);
        if (qty < 1)
            throw new exception_1.BadRequestException("Release quantity must be at least 1");
        return await (0, utils_1.withTransaction)(async (session) => {
            const branchQuota = await module_1.BranchQuotaModel.findOneAndUpdate({
                tripId,
                branchId,
                availableSeats: { $gte: qty },
            }, {
                $inc: {
                    allocatedSeats: -qty,
                    availableSeats: -qty,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!branchQuota) {
                throw new exception_1.InsufficientInventoryError("Branch does not have enough available unreserved seats to release");
            }
            const trip = await module_1.TripModel.findOneAndUpdate({ _id: tripId }, {
                $inc: {
                    availableInventory: qty,
                    allocatedToBranchesSeats: -qty,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            await module_1.InventoryMovementModel.create([
                {
                    tripId: new mongoose_1.default.Types.ObjectId(tripId),
                    branchId: new mongoose_1.default.Types.ObjectId(branchId),
                    action: "RELEASE_BRANCH",
                    quantity: qty,
                    notes: notes || `Released ${qty} seats from branch back to central pool`,
                    actorId: req.user?._id,
                },
            ], session ? { session } : undefined);
            await service_1.auditService.record({
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
    async reserveSeatsAtomically({ tripId, branchId, quantity = 1, holdMinutes = config_1.BOOKING_HOLD_DEFAULT_MINUTES, idempotencyKey, bookingId, bookingReference, actorId, session, }) {
        const qty = Math.floor(quantity);
        if (qty < 1)
            throw new exception_1.BadRequestException("Reservation quantity must be at least 1");
        if (idempotencyKey) {
            const existingRes = await module_1.InventoryReservationModel.findOne({ idempotencyKey }, null, session ? { session } : undefined);
            if (existingRes) {
                return existingRes;
            }
        }
        const tripMeta = await module_1.TripModel.findById(tripId, "quotaMode status", session ? { session } : undefined);
        if (!tripMeta) {
            throw new exception_1.NotFoundException("Trip not found");
        }
        if (tripMeta.status !== "OPEN_FOR_BOOKING" && tripMeta.status !== "PUBLISHED") {
            throw new exception_1.BadRequestException(`Trip is not open for booking (current status: ${tripMeta.status})`);
        }
        let quotaSource = "SHARED";
        if (tripMeta.quotaMode === "ALLOCATED_QUOTA") {
            quotaSource = "BRANCH_ALLOCATED";
            const updatedBranchQuota = await module_1.BranchQuotaModel.findOneAndUpdate({
                tripId: new mongoose_1.default.Types.ObjectId(tripId.toString()),
                branchId: new mongoose_1.default.Types.ObjectId(branchId.toString()),
                status: "ACTIVE",
                availableSeats: { $gte: qty },
            }, {
                $inc: {
                    availableSeats: -qty,
                    reservedSeats: qty,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!updatedBranchQuota) {
                throw new exception_1.InsufficientInventoryError("Insufficient available branch quota for this trip");
            }
            await module_1.TripModel.updateOne({ _id: tripId }, { $inc: { reservedSeats: qty } }, session ? { session } : undefined);
        }
        else {
            const updatedTrip = await module_1.TripModel.findOneAndUpdate({
                _id: new mongoose_1.default.Types.ObjectId(tripId.toString()),
                availableInventory: { $gte: qty },
            }, {
                $inc: {
                    availableInventory: -qty,
                    reservedSeats: qty,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!updatedTrip) {
                throw new exception_1.InsufficientInventoryError("Insufficient available seats in trip inventory");
            }
        }
        const expiresAt = new Date(Date.now() + holdMinutes * 60 * 1000);
        const [reservation] = await module_1.InventoryReservationModel.create([
            {
                ...(idempotencyKey ? { idempotencyKey } : {}),
                tripId: new mongoose_1.default.Types.ObjectId(tripId.toString()),
                branchId: new mongoose_1.default.Types.ObjectId(branchId.toString()),
                bookingId: bookingId ? new mongoose_1.default.Types.ObjectId(bookingId.toString()) : null,
                bookingReference,
                quantity: qty,
                quotaSource,
                expiresAt,
                status: "ACTIVE_HOLD",
                createdBy: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : undefined,
            },
        ], session ? { session } : undefined);
        await module_1.InventoryMovementModel.create([
            {
                tripId: new mongoose_1.default.Types.ObjectId(tripId.toString()),
                branchId: new mongoose_1.default.Types.ObjectId(branchId.toString()),
                action: "RESERVE_SEATS",
                quantity: qty,
                referenceId: bookingReference || reservation._id.toString(),
                notes: `Reserved ${qty} seat(s) (${quotaSource})`,
                actorId: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : undefined,
            },
        ], session ? { session } : undefined);
        return reservation;
    }
    async consumeReservation({ reservationId, actorId, session, }) {
        const reservation = await module_1.InventoryReservationModel.findOneAndUpdate({
            _id: reservationId,
            status: "ACTIVE_HOLD",
        }, {
            $set: { status: "CONSUMED" },
        }, { returnDocument: "after", ...(session ? { session } : {}) });
        if (!reservation) {
            throw new exception_1.InsufficientInventoryError("Active seat reservation not found or has already expired");
        }
        if (reservation.quotaSource === "BRANCH_ALLOCATED") {
            await module_1.BranchQuotaModel.updateOne({ tripId: reservation.tripId, branchId: reservation.branchId }, {
                $inc: {
                    reservedSeats: -reservation.quantity,
                    consumedSeats: reservation.quantity,
                },
            }, session ? { session } : undefined);
        }
        await module_1.TripModel.updateOne({ _id: reservation.tripId }, {
            $inc: {
                reservedSeats: -reservation.quantity,
                confirmedSoldSeats: reservation.quantity,
            },
        }, session ? { session } : undefined);
        await module_1.InventoryMovementModel.create([
            {
                tripId: reservation.tripId,
                branchId: reservation.branchId,
                action: "CONSUME_SEATS",
                quantity: reservation.quantity,
                referenceId: reservation.bookingReference || reservation._id.toString(),
                notes: `Consumed ${reservation.quantity} seat(s) on confirmation`,
                actorId: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : undefined,
            },
        ], session ? { session } : undefined);
        return reservation;
    }
    async releaseReservation({ reservationId, reason = "RELEASED", actorId, session, }) {
        const reservation = await module_1.InventoryReservationModel.findById(reservationId, null, session ? { session } : undefined);
        if (!reservation || reservation.status === "RELEASED" || reservation.status === "EXPIRED") {
            return reservation;
        }
        const prevStatus = reservation.status;
        reservation.status = reason;
        await reservation.save(session ? { session } : undefined);
        const qty = reservation.quantity;
        if (reservation.quotaSource === "BRANCH_ALLOCATED") {
            await module_1.BranchQuotaModel.updateOne({ tripId: reservation.tripId, branchId: reservation.branchId }, {
                $inc: {
                    availableSeats: qty,
                    ...(prevStatus === "ACTIVE_HOLD" ? { reservedSeats: -qty } : {}),
                    ...(prevStatus === "CONSUMED" ? { consumedSeats: -qty } : {}),
                },
            }, session ? { session } : undefined);
            await module_1.TripModel.updateOne({ _id: reservation.tripId }, {
                $inc: {
                    ...(prevStatus === "ACTIVE_HOLD" ? { reservedSeats: -qty } : {}),
                    ...(prevStatus === "CONSUMED" ? { confirmedSoldSeats: -qty } : {}),
                },
            }, session ? { session } : undefined);
        }
        else {
            await module_1.TripModel.updateOne({ _id: reservation.tripId }, {
                $inc: {
                    availableInventory: qty,
                    ...(prevStatus === "ACTIVE_HOLD" ? { reservedSeats: -qty } : {}),
                    ...(prevStatus === "CONSUMED" ? { confirmedSoldSeats: -qty } : {}),
                },
            }, session ? { session } : undefined);
        }
        await module_1.InventoryMovementModel.create([
            {
                tripId: reservation.tripId,
                branchId: reservation.branchId,
                action: reason === "EXPIRED" ? "EXPIRE_RESERVATION" : "RELEASE_RESERVATION",
                quantity: qty,
                referenceId: reservation.bookingReference || reservation._id.toString(),
                notes: `Released ${qty} seat(s) from ${prevStatus} (${reason})`,
                actorId: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : undefined,
            },
        ], session ? { session } : undefined);
        return reservation;
    }
}
exports.QuotaService = QuotaService;
exports.quotaService = new QuotaService();
