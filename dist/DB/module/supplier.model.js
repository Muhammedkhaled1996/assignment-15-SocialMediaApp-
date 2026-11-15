"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupplierModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const supplierSchema = new mongoose_1.default.Schema({
    companyId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Company", index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ["AIRLINE", "BROKER", "HOTEL", "SAUDI_AGENT", "TRANSPORT", "OTHER"],
        required: true,
        index: true,
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    country: { type: String, trim: true, default: "SA" },
    taxNumber: { type: String, trim: true },
    commercialRegister: { type: String, trim: true },
    bankDetails: {
        bankName: { type: String, trim: true },
        accountName: { type: String, trim: true },
        accountNumber: { type: String, trim: true },
        iban: { type: String, trim: true },
        swiftCode: { type: String, trim: true },
    },
    currency: { type: String, enum: ["EGP", "SAR", "USD", "EUR"], default: "SAR", index: true },
    openingBalance: { type: Number, default: 0 },
    totalObligations: { type: Number, default: 0 },
    totalPayments: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE", index: true },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
supplierSchema.index({ type: 1, status: 1 });
exports.SupplierModel = mongoose_1.default.models.Supplier || mongoose_1.default.model("Supplier", supplierSchema);
