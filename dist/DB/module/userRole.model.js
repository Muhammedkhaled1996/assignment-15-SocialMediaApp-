"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRoleModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userRoleSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roleId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Role", required: true, index: true },
    roleCode: { type: String, required: true, uppercase: true, trim: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    status: { type: String, enum: ["ACTIVE", "REVOKED"], default: "ACTIVE", index: true },
    assignedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    revokedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date },
}, { timestamps: true, strict: true });
userRoleSchema.index({ userId: 1, roleId: 1, branchId: 1 });
userRoleSchema.index({ userId: 1, status: 1 });
exports.UserRoleModel = mongoose_1.default.models.UserRoleAssignment ||
    mongoose_1.default.model("UserRoleAssignment", userRoleSchema);
