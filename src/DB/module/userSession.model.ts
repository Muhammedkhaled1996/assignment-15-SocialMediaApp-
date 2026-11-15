import mongoose, { HydratedDocument } from "mongoose";

export interface IUserSession {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  jti: string;
  familyId: string;
  refreshTokenHash: string;
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
  isRevoked: boolean;
  revokedReason?: string | undefined;
  revokedAt?: Date | undefined;
  replacedByJti?: string | undefined;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const userSessionSchema = new mongoose.Schema<IUserSession>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    isRevoked: { type: Boolean, default: false, index: true },
    revokedReason: { type: String },
    revokedAt: { type: Date },
    replacedByJti: { type: String },
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: true },
);

userSessionSchema.index({ userId: 1, isRevoked: 1 });

export const UserSessionModel =
  (mongoose.models.UserSession as mongoose.Model<IUserSession>) ||
  mongoose.model<IUserSession>("UserSession", userSessionSchema);
export type HUserSession = HydratedDocument<IUserSession>;

