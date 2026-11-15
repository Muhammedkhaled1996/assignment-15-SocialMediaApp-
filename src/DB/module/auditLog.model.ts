import mongoose, { HydratedDocument } from "mongoose";

export interface IAuditLog {
  _id?: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId | null | undefined;
  actorEmail?: string | undefined;
  actorRoles?: string[] | undefined;
  action: string;
  module: string;
  entityType: string;
  entityId?: string | undefined;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  companyId?: mongoose.Types.ObjectId | null | undefined;
  requestId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  previousValues?: Record<string, any> | null | undefined;
  newValues?: Record<string, any> | null | undefined;
  metadata?: Record<string, any> | undefined;
  timestamp: Date;
}

const auditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    actorEmail: { type: String, trim: true },
    actorRoles: [{ type: String }],
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    requestId: { type: String, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
    previousValues: { type: mongoose.Schema.Types.Mixed },
    newValues: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, immutable: true, index: true },
  },
  {
    timestamps: false,
    strict: true,
  },
);

auditLogSchema.index({ module: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, timestamp: -1 });
auditLogSchema.index({ branchId: 1, timestamp: -1 });

export const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) || mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
export type HAuditLog = HydratedDocument<IAuditLog>;

