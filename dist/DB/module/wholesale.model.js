"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WholesaleContractModel = exports.WholesalePartnerModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const wholesalePartnerSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    companyNameAr: { type: String, required: true, trim: true },
    companyNameEn: { type: String, required: true, trim: true },
    tourismLicenseNumber: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    totalContractedAmount: { type: Number, default: 0, min: 0 },
    totalPaidAmount: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED", "INACTIVE"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
exports.WholesalePartnerModel = mongoose_1.default.models.WholesalePartner ||
    mongoose_1.default.model("WholesalePartner", wholesalePartnerSchema);
const wholesaleContractSchema = new mongoose_1.default.Schema({
    contractNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    partnerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "WholesalePartner", required: true, index: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    allocationType: { type: String, enum: ["SEAT_BLOCK", "ENTIRE_TRIP"], required: true, default: "SEAT_BLOCK" },
    seatQuantity: { type: Number, required: true, min: 1 },
    releasedSeats: { type: Number, default: 0, min: 0 },
    unitPriceEgp: { type: Number, required: true, min: 0 },
    totalContractPriceEgp: { type: Number, required: true, min: 0 },
    depositAmountEgp: { type: Number, default: 0, min: 0 },
    paidAmountEgp: { type: Number, default: 0, min: 0 },
    remainingBalanceEgp: { type: Number, required: true, min: 0 },
    paymentSchedule: [
        {
            dueDate: { type: Date, required: true },
            amount: { type: Number, required: true, min: 0 },
            status: { type: String, enum: ["PENDING", "PAID", "OVERDUE"], default: "PENDING" },
        },
    ],
    attachments: [{ type: String }],
    status: {
        type: String,
        enum: ["ACTIVE", "PARTIALLY_RELEASED", "COMPLETED", "CANCELLED"],
        default: "ACTIVE",
        index: true,
    },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
wholesaleContractSchema.index({ tripId: 1, status: 1 });
exports.WholesaleContractModel = mongoose_1.default.models.WholesaleContract ||
    mongoose_1.default.model("WholesaleContract", wholesaleContractSchema);
