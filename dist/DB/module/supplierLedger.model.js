"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierLedgerEntryModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const supplierLedgerEntrySchema = new mongoose_1.default.Schema({
    supplierId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", index: true },
    entryType: {
        type: String,
        enum: [
            "OPENING_BALANCE",
            "CONTRACT_OBLIGATION",
            "DEPOSIT",
            "PARTIAL_PAYMENT",
            "FULL_PAYMENT",
            "CREDIT_NOTE",
            "ADJUSTMENT",
        ],
        required: true,
        index: true,
    },
    referenceType: {
        type: String,
        enum: ["SUPPLIER", "FLIGHT_LOT", "HOTEL_CONTRACT", "PAYMENT_VOUCHER", "MANUAL_ADJUSTMENT", "TRIP"],
        required: true,
    },
    referenceId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true, index: true },
    referenceNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    currency: { type: String, enum: ["EGP", "SAR", "USD", "EUR"], required: true },
    debitAmount: { type: Number, required: true, default: 0, min: 0 },
    creditAmount: { type: Number, required: true, default: 0, min: 0 },
    runningBalance: { type: Number, required: true },
    exchangeRateToEgp: { type: Number, default: 1, min: 0 },
    amountInEgp: { type: Number, required: true },
    dueDate: { type: Date, index: true },
    isPaid: { type: Boolean, default: false, index: true },
    effectiveDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
supplierLedgerEntrySchema.index({ supplierId: 1, effectiveDate: 1, _id: 1 });
supplierLedgerEntrySchema.index({ supplierId: 1, dueDate: 1, isPaid: 1 });
exports.SupplierLedgerEntryModel = mongoose_1.default.models.SupplierLedgerEntry ||
    mongoose_1.default.model("SupplierLedgerEntry", supplierLedgerEntrySchema);
