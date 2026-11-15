"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryMovementModel = exports.InventoryReservationModel = exports.BranchQuotaModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const branchQuotaSchema = new mongoose_1.default.Schema({
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    allocatedSeats: { type: Number, required: true, min: 0 },
    availableSeats: { type: Number, required: true, min: 0 },
    reservedSeats: { type: Number, required: true, default: 0, min: 0 },
    consumedSeats: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "RELEASED", "CLOSED"], default: "ACTIVE" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
branchQuotaSchema.index({ tripId: 1, branchId: 1 }, { unique: true });
exports.BranchQuotaModel = mongoose_1.default.models.BranchQuota ||
    mongoose_1.default.model("BranchQuota", branchQuotaSchema);
const inventoryReservationSchema = new mongoose_1.default.Schema({
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    bookingId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    bookingReference: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    quotaSource: { type: String, enum: ["SHARED", "BRANCH_ALLOCATED", "WHOLESALE"], required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
        type: String,
        enum: ["ACTIVE_HOLD", "CONSUMED", "RELEASED", "EXPIRED"],
        default: "ACTIVE_HOLD",
        index: true,
    },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ tripId: 1, branchId: 1, status: 1 });
exports.InventoryReservationModel = mongoose_1.default.models.InventoryReservation ||
    mongoose_1.default.model("InventoryReservation", inventoryReservationSchema);
const inventoryMovementSchema = new mongoose_1.default.Schema({
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    targetBranchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null },
    action: {
        type: String,
        enum: [
            "ALLOCATE_BRANCH",
            "TRANSFER_BRANCH",
            "RELEASE_BRANCH",
            "RESERVE_SEATS",
            "CONSUME_SEATS",
            "RELEASE_RESERVATION",
            "EXPIRE_RESERVATION",
            "WHOLESALE_ALLOCATE",
            "WHOLESALE_RELEASE",
            "RECONCILE",
        ],
        required: true,
        index: true,
    },
    quantity: { type: Number, required: true },
    referenceId: { type: String },
    notes: { type: String },
    actorId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
inventoryMovementSchema.index({ tripId: 1, createdAt: -1 });
exports.InventoryMovementModel = mongoose_1.default.models.InventoryMovement ||
    mongoose_1.default.model("InventoryMovement", inventoryMovementSchema);
