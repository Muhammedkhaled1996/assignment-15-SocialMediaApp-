"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const companySchema = new mongoose_1.default.Schema({
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    logoUrl: { type: String, trim: true },
    primaryColor: { type: String, trim: true, default: "#0F172A" },
    secondaryColor: { type: String, trim: true, default: "#D97706" },
    website: { type: String, trim: true },
    supportedTourismTypes: {
        type: [{ type: String, enum: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"] }],
        default: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"],
    },
    taxNumber: { type: String, trim: true },
    commercialRegister: { type: String, trim: true },
    tourismLicenseNumber: { type: String, trim: true },
    baseCurrency: { type: String, default: "EGP", uppercase: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
exports.CompanyModel = mongoose_1.default.models.Company || mongoose_1.default.model("Company", companySchema);
