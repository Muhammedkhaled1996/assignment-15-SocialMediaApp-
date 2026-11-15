"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bookingSchema = new mongoose_1.default.Schema({
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    bookingNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    groupId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    passengerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Passenger", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    reservationId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "InventoryReservation", default: null },
    roomType: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD"], required: true },
    roomNumberMakkah: { type: String, trim: true },
    roomNumberMadinah: { type: String, trim: true },
    passengerCategory: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"], required: true },
    priceSnapshot: {
        pricingVersionId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "PricingVersion", required: true },
        pricingVersionCode: { type: String, required: true },
        exchangeRateSarToEgp: { type: Number, required: true },
        category: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"], required: true },
        costPerPassengerEgp: { type: Number, required: true },
        approvedSellingPriceEgp: { type: Number, required: true },
        minimumSellingPriceEgp: { type: Number, required: true },
    },
    grossAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    netSellingPrice: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    refundedAmount: { type: Number, required: true, default: 0, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["EGP"], default: "EGP" },
    paymentRecordIds: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Receipt" }],
    status: {
        type: String,
        enum: ["DRAFT", "ON_HOLD", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED"],
        default: "ON_HOLD",
        index: true,
    },
    holdExpiresAt: { type: Date, default: null, index: true },
    passportWarning: { type: String, default: null },
    mahramPassengerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Passenger", default: null },
    familyGroupCode: { type: String, trim: true, uppercase: true, index: true },
    history: [
        {
            fromStatus: { type: String },
            toStatus: { type: String, required: true },
            changedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            reason: { type: String },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    confirmedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", default: null },
    confirmedAt: { type: Date, default: null },
    cancelledBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String },
}, { timestamps: true, strict: true });
bookingSchema.index({ tripId: 1, branchId: 1, status: 1 });
bookingSchema.index({ tripId: 1, passengerId: 1 });
bookingSchema.index({ branchId: 1, createdAt: -1 });
exports.BookingModel = mongoose_1.default.models.Booking || mongoose_1.default.model("Booking", bookingSchema);
