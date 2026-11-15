import mongoose, { HydratedDocument } from "mongoose";
import { PassengerCategory } from "./pricingVersion.model";

export type BookingState =
  | "DRAFT"
  | "ON_HOLD"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export interface IBookingPriceSnapshot {
  pricingVersionId: mongoose.Types.ObjectId;
  pricingVersionCode: string;
  exchangeRateSarToEgp: number;
  category: PassengerCategory;
  costPerPassengerEgp: number;
  approvedSellingPriceEgp: number;
  minimumSellingPriceEgp: number;
}

export interface IBookingHistoryItem {
  fromStatus?: BookingState | null | undefined;
  toStatus: BookingState;
  changedBy?: mongoose.Types.ObjectId | undefined;
  reason?: string | undefined;
  timestamp: Date;
}

export interface IBooking {
  _id?: mongoose.Types.ObjectId;
  idempotencyKey?: string | undefined;
  bookingNumber: string;
  tripId: mongoose.Types.ObjectId;
  groupId?: mongoose.Types.ObjectId | null | undefined;
  passengerId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  reservationId?: mongoose.Types.ObjectId | null | undefined;
  roomType: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD";
  roomNumberMakkah?: string | undefined;
  roomNumberMadinah?: string | undefined;
  passengerCategory: PassengerCategory;
  priceSnapshot: IBookingPriceSnapshot;
  grossAmount: number;
  discountAmount: number;
  netSellingPrice: number;
  amountPaid: number;
  refundedAmount: number;
  remainingBalance: number;
  currency: "EGP";
  paymentRecordIds: mongoose.Types.ObjectId[];
  status: BookingState;
  holdExpiresAt?: Date | null | undefined;
  passportWarning?: string | null | undefined;
  mahramPassengerId?: mongoose.Types.ObjectId | null | undefined;
  familyGroupCode?: string | undefined;
  history: IBookingHistoryItem[];
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  confirmedBy?: mongoose.Types.ObjectId | null | undefined;
  confirmedAt?: Date | null | undefined;
  cancelledBy?: mongoose.Types.ObjectId | null | undefined;
  cancelledAt?: Date | null | undefined;
  cancellationReason?: string | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const bookingSchema = new mongoose.Schema<IBooking>(
  {
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    bookingNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "Passenger", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    reservationId: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryReservation", default: null },
    roomType: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD"], required: true },
    roomNumberMakkah: { type: String, trim: true },
    roomNumberMadinah: { type: String, trim: true },
    passengerCategory: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"], required: true },
    priceSnapshot: {
      pricingVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "PricingVersion", required: true },
      pricingVersionCode: { type: String, required: true },
      exchangeRateSarToEgp: { type: Number, required: true },
      category: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"], required: true },
      costPerPassengerEgp: { type: Number, required: true },
      approvedSellingPriceEgp: { type: Number, required: true },
      minimumSellingPriceEgp: { type: Number, required: true },
    },
    grossAmount: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    netSellingPrice: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    refundedAmount: { type: Number, required: true, default: 0, min: 0 },
    remainingBalance: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["EGP"], default: "EGP" },
    paymentRecordIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Receipt" }],
    status: {
      type: String,
      enum: ["DRAFT", "ON_HOLD", "PENDING_PAYMENT", "CONFIRMED", "COMPLETED", "CANCELLED", "REFUNDED"],
      default: "ON_HOLD",
      index: true,
    },
    holdExpiresAt: { type: Date, default: null, index: true },
    passportWarning: { type: String, default: null },
    mahramPassengerId: { type: mongoose.Schema.Types.ObjectId, ref: "Passenger", default: null },
    familyGroupCode: { type: String, trim: true, uppercase: true, index: true },
    history: [
      {
        fromStatus: { type: String },
        toStatus: { type: String, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    confirmedAt: { type: Date, default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String },
  },
  { timestamps: true, strict: true },
);

bookingSchema.index({ tripId: 1, branchId: 1, status: 1 });
bookingSchema.index({ tripId: 1, passengerId: 1 });
bookingSchema.index({ branchId: 1, createdAt: -1 });

export const BookingModel =
  (mongoose.models.Booking as mongoose.Model<IBooking>) || mongoose.model<IBooking>("Booking", bookingSchema);
export type HBooking = HydratedDocument<IBooking>;
