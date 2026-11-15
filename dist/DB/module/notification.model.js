"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileAttachmentModel = exports.SystemSettingModel = exports.NotificationModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const notificationSchema = new mongoose_1.default.Schema({
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
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    recipientUserId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    entityType: { type: String },
    entityId: { type: String },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
notificationSchema.index({ branchId: 1, isRead: 1, createdAt: -1 });
exports.NotificationModel = mongoose_1.default.models.Notification ||
    mongoose_1.default.model("Notification", notificationSchema);
const systemSettingSchema = new mongoose_1.default.Schema({
    key: { type: String, required: true, unique: true, uppercase: true, trim: true },
    value: { type: mongoose_1.default.Schema.Types.Mixed, required: true },
    category: {
        type: String,
        enum: ["GENERAL", "PRICING", "PASSPORT_POLICY", "DOCUMENT_TEMPLATE", "NOTIFICATIONS"],
        default: "GENERAL",
        index: true,
    },
    description: { type: String },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
exports.SystemSettingModel = mongoose_1.default.models.SystemSetting ||
    mongoose_1.default.model("SystemSetting", systemSettingSchema);
const fileAttachmentSchema = new mongoose_1.default.Schema({
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storageProvider: { type: String, enum: ["LOCAL", "S3"], default: "LOCAL" },
    storageKey: { type: String, required: true },
    uploadedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    relatedEntityType: { type: String, index: true },
    relatedEntityId: { type: String, index: true },
    isSensitive: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
exports.FileAttachmentModel = mongoose_1.default.models.FileAttachment ||
    mongoose_1.default.model("FileAttachment", fileAttachmentSchema);
