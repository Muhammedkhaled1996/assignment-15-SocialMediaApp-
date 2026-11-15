import mongoose, { ClientSession } from "mongoose";
import { Request } from "express";
import { AuditLogModel, IAuditLog } from "../../DB/module/auditLog.model";
import { USER_ROLE_LABELS, UserRole } from "../enum/userRole.enum";

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

function redactSensitive(value: any): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date || value instanceof mongoose.Types.ObjectId || typeof value !== "object") {
    return value;
  }
  if (typeof value.toObject === "function") {
    value = value.toObject();
  }
  if (Array.isArray(value)) {
    return value.map(redactSensitive);
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(k)) {
      clean[k] = "[REDACTED]";
    } else {
      clean[k] = redactSensitive(v);
    }
  }
  return clean;
}

export interface IRecordAuditParams {
  req?: Request | undefined;
  actorId?: string | mongoose.Types.ObjectId | null | undefined;
  actorEmail?: string | undefined;
  actorRoles?: string[] | undefined;
  action: string;
  module: string;
  entityType: string;
  entityId?: string | mongoose.Types.ObjectId | undefined;
  branchId?: string | mongoose.Types.ObjectId | null | undefined;
  companyId?: string | mongoose.Types.ObjectId | null | undefined;
  previousValues?: Record<string, any> | null | undefined;
  newValues?: Record<string, any> | null | undefined;
  metadata?: Record<string, any> | undefined;
  session?: ClientSession | undefined;
}

export class AuditService {
  async record(params: IRecordAuditParams): Promise<IAuditLog> {
    const req = params.req;
    const actorId = params.actorId ?? req?.user?._id ?? null;
    const actorEmail = params.actorEmail ?? req?.user?.email;
    const roleNum = req?.user?.roleNumber as UserRole | undefined;
    const actorRoles =
      params.actorRoles ??
      (roleNum ? [USER_ROLE_LABELS[roleNum] || `ROLE_${roleNum}`] : []);
    const branchId =
      params.branchId ??
      (req?.branchContext?.activeBranchId ? new mongoose.Types.ObjectId(req.branchContext.activeBranchId) : null) ??
      req?.user?.branchId ??
      req?.user?.primaryBranchId ??
      null;
    const companyId = params.companyId ?? req?.user?.companyId ?? null;

    const entryData: Partial<IAuditLog> = {
      actorId: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : null,
      actorEmail,
      actorRoles,
      action: params.action,
      module: params.module,
      entityType: params.entityType,
      entityId: params.entityId ? params.entityId.toString() : undefined,
      branchId: branchId ? new mongoose.Types.ObjectId(branchId.toString()) : null,
      companyId: companyId ? new mongoose.Types.ObjectId(companyId.toString()) : null,
      requestId: req?.requestId || (req?.headers?.["x-request-id"] as string | undefined),
      ipAddress: req?.ip || req?.socket?.remoteAddress,
      userAgent: req?.headers?.["user-agent"],
      previousValues: params.previousValues ? redactSensitive(params.previousValues) : null,
      newValues: params.newValues ? redactSensitive(params.newValues) : null,
      metadata: params.metadata ? redactSensitive(params.metadata) : undefined,
      timestamp: new Date(),
    };

    const [created] = await AuditLogModel.create([entryData], params.session ? { session: params.session } : undefined);
    return created!;
  }
}

export const auditService = new AuditService();
