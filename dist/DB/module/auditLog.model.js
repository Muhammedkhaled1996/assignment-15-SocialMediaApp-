"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const auditLogSchema = new mongoose_1.default.Schema({
    actorId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", index: true },
    actorEmail: { type: String, trim: true },
    actorRoles: [{ type: String }],
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", index: true },
    companyId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Company", index: true },
    requestId: { type: String, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    previousValues: { type: mongoose_1.default.Schema.Types.Mixed },
    newValues: { type: mongoose_1.default.Schema.Types.Mixed },
    metadata: { type: mongoose_1.default.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, immutable: true, index: true },
}, {
    timestamps: false,
    strict: true,
});
auditLogSchema.index({ module: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ branchId: 1, timestamp: -1 });
exports.AuditLogModel = mongoose_1.default.models.AuditLog || mongoose_1.default.model("AuditLog", auditLogSchema);
