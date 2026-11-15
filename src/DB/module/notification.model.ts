import mongoose, { HydratedDocument } from "mongoose";

export type NotificationType =
  | "UPCOMING_SUPPLIER_PAYMENT"
  | "OVERDUE_SUPPLIER_PAYMENT"
  | "BOOKING_HOLD_EXPIRATION"
  | "PASSPORT_VALIDITY_WARNING"
  | "LOW_TRIP_INVENTORY"
  | "PENDING_APPROVAL"
  | "CASHBOX_DISCREPANCY"
  | "UPCOMING_TRAVEL_DATE";

export interface INotification {
  _id?: mongoose.Types.ObjectId;
  deduplicationKey?: string | undefined;
  type: NotificationType;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  recipientUserId?: mongoose.Types.ObjectId | null | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  isRead: boolean;
  readAt?: Date | null | undefined;
  createdAt?: Date;
}

const notificationSchema = new mongoose.Schema<INotification>(
  {
    deduplicationKey: { type: String, unique: true, sparse: true, index: true },
    type: {
      type: String,
      enum: [
        "UPCOMING_SUPPLIER_PAYMENT",
        "OVERDUE_SUPPLIER_PAYMENT",
        "BOOKING_HOLD_EXPIRATION",
        "PASSPORT_VALIDITY_WARNING",
        "LOW_TRIP_INVENTORY",
        "PENDING_APPROVAL",
        "CASHBOX_DISCREPANCY",
        "UPCOMING_TRAVEL_DATE",
      ],
      required: true,
      index: true,
    },
    titleAr: { type: String, required: true },
    titleEn: { type: String, required: true },
    messageAr: { type: String, required: true },
    messageEn: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    recipientUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    entityType: { type: String },
    entityId: { type: String },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

notificationSchema.index({ branchId: 1, isRead: 1, createdAt: -1 });

export const NotificationModel =
  (mongoose.models.Notification as mongoose.Model<INotification>) ||
  mongoose.model<INotification>("Notification", notificationSchema);
export type HNotification = HydratedDocument<INotification>;

export interface ISystemSetting {
  _id?: mongoose.Types.ObjectId;
  key: string;
  value: any;
  category: "GENERAL" | "PRICING" | "PASSPORT_POLICY" | "DOCUMENT_TEMPLATE" | "NOTIFICATIONS";
  description?: string | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  updatedAt?: Date;
}

const systemSettingSchema = new mongoose.Schema<ISystemSetting>(
  {
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    category: {
      type: String,
      enum: ["GENERAL", "PRICING", "PASSPORT_POLICY", "DOCUMENT_TEMPLATE", "NOTIFICATIONS"],
      default: "GENERAL",
      index: true,
    },
    description: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

export const SystemSettingModel =
  (mongoose.models.SystemSetting as mongoose.Model<ISystemSetting>) ||
  mongoose.model<ISystemSetting>("SystemSetting", systemSettingSchema);

export interface IFileAttachment {
  _id?: mongoose.Types.ObjectId;
  originalName: string;
  mimeType: string;
  size: number;
  storageProvider: "LOCAL" | "S3";
  storageKey: string;
  uploadedBy?: mongoose.Types.ObjectId | undefined;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  relatedEntityType?: string | undefined;
  relatedEntityId?: string | undefined;
  isSensitive: boolean;
  createdAt?: Date;
}

const fileAttachmentSchema = new mongoose.Schema<IFileAttachment>(
  {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageProvider: { type: String, enum: ["LOCAL", "S3"], default: "LOCAL" },
    storageKey: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    relatedEntityType: { type: String, index: true },
    relatedEntityId: { type: String, index: true },
    isSensitive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

export const FileAttachmentModel =
  (mongoose.models.FileAttachment as mongoose.Model<IFileAttachment>) ||
  mongoose.model<IFileAttachment>("FileAttachment", fileAttachmentSchema);
