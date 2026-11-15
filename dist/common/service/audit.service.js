"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditService = exports.AuditService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const auditLog_model_1 = require("../../DB/module/auditLog.model");
const userRole_enum_1 = require("../enum/userRole.enum");
const SENSITIVE_KEYS = new Set([
    "password",
    "confirmPassword",
    "oldPassword",
    "newPassword",
    "token",
    "access_token",
    "refresh_token",
    "refreshToken",
    "refreshTokenHash",
    "otp",
]);
function redactSensitive(value) {
    if (value === null || value === undefined)
        return value;
    if (value instanceof Date || value instanceof mongoose_1.default.Types.ObjectId || typeof value !== "object") {
        return value;
    }
    if (typeof value.toObject === "function") {
        value = value.toObject();
    }
    if (Array.isArray(value)) {
        return value.map(redactSensitive);
    }
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
        if (SENSITIVE_KEYS.has(k)) {
            clean[k] = "[REDACTED]";
        }
        else {
            clean[k] = redactSensitive(v);
        }
    }
    return clean;
}
class AuditService {
    async record(params) {
        const req = params.req;
        const actorId = params.actorId ?? req?.user?._id ?? null;
        const actorEmail = params.actorEmail ?? req?.user?.email;
        const roleNum = req?.user?.roleNumber;
        const actorRoles = params.actorRoles ??
            (roleNum ? [userRole_enum_1.USER_ROLE_LABELS[roleNum] || `ROLE_${roleNum}`] : []);
        const branchId = params.branchId ??
            (req?.branchContext?.activeBranchId ? new mongoose_1.default.Types.ObjectId(req.branchContext.activeBranchId) : null) ??
            req?.user?.branchId ??
            req?.user?.primaryBranchId ??
            null;
        const companyId = params.companyId ?? req?.user?.companyId ?? null;
        const entryData = {
            actorId: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : null,
            actorEmail,
            actorRoles,
            action: params.action,
            module: params.module,
            entityType: params.entityType,
            entityId: params.entityId ? params.entityId.toString() : undefined,
            branchId: branchId ? new mongoose_1.default.Types.ObjectId(branchId.toString()) : null,
            companyId: companyId ? new mongoose_1.default.Types.ObjectId(companyId.toString()) : null,
            requestId: req?.requestId || req?.headers?.["x-request-id"],
            ipAddress: req?.ip || req?.socket?.remoteAddress,
            userAgent: req?.headers?.["user-agent"],
            previousValues: params.previousValues ? redactSensitive(params.previousValues) : null,
            newValues: params.newValues ? redactSensitive(params.newValues) : null,
            metadata: params.metadata ? redactSensitive(params.metadata) : undefined,
            timestamp: new Date(),
        };
        const [created] = await auditLog_model_1.AuditLogModel.create([entryData], params.session ? { session: params.session } : undefined);
        return created;
    }
}
exports.AuditService = AuditService;
exports.auditService = new AuditService();
