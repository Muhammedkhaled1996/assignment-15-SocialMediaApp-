"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const branchSchema = new mongoose_1.default.Schema({
    companyId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Company", index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    governorate: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    managerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    isHeadquarters: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
}, { timestamps: true, strict: true });
branchSchema.index({ companyId: 1, status: 1 });
exports.BranchModel = mongoose_1.default.models.Branch || mongoose_1.default.model("Branch", branchSchema);
