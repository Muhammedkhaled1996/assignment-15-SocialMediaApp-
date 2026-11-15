import mongoose, { HydratedDocument } from "mongoose";

export interface IWholesalePartner {
  _id?: mongoose.Types.ObjectId;
  code: string;
  companyNameAr: string;
  companyNameEn: string;
  tourismLicenseNumber?: string | undefined;
  taxNumber?: string | undefined;
  contactPerson: string;
  phone: string;
  email?: string | undefined;
  address?: string | undefined;
  totalContractedAmount: number;
  totalPaidAmount: number;
  currentBalance: number;
  status: "ACTIVE" | "SUSPENDED" | "INACTIVE";
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const wholesalePartnerSchema = new mongoose.Schema<IWholesalePartner>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    companyNameAr: { type: String, required: true, trim: true },
    companyNameEn: { type: String, required: true, trim: true },
    tourismLicenseNumber: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    totalContractedAmount: { type: Number, default: 0, min: 0 },
    totalPaidAmount: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "SUSPENDED", "INACTIVE"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

export const WholesalePartnerModel =
  (mongoose.models.WholesalePartner as mongoose.Model<IWholesalePartner>) ||
  mongoose.model<IWholesalePartner>("WholesalePartner", wholesalePartnerSchema);
export type HWholesalePartner = HydratedDocument<IWholesalePartner>;

export interface IWholesaleContract {
  _id?: mongoose.Types.ObjectId;
  contractNumber: string;
  partnerId: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  allocationType: "SEAT_BLOCK" | "ENTIRE_TRIP";
  seatQuantity: number;
  releasedSeats: number;
  unitPriceEgp: number;
  totalContractPriceEgp: number;
  depositAmountEgp: number;
  paidAmountEgp: number;
  remainingBalanceEgp: number;
  paymentSchedule: Array<{
    dueDate: Date;
    amount: number;
    status: "PENDING" | "PAID" | "OVERDUE";
  }>;
  attachments: string[];
  status: "ACTIVE" | "PARTIALLY_RELEASED" | "COMPLETED" | "CANCELLED";
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const wholesaleContractSchema = new mongoose.Schema<IWholesaleContract>(
  {
    contractNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    partnerId: { type: mongoose.Schema.Types.ObjectId, ref: "WholesalePartner", required: true, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    allocationType: { type: String, enum: ["SEAT_BLOCK", "ENTIRE_TRIP"], required: true, default: "SEAT_BLOCK" },
    seatQuantity: { type: Number, required: true, min: 1 },
    releasedSeats: { type: Number, default: 0, min: 0 },
    unitPriceEgp: { type: Number, required: true, min: 0 },
    totalContractPriceEgp: { type: Number, required: true, min: 0 },
    depositAmountEgp: { type: Number, default: 0, min: 0 },
    paidAmountEgp: { type: Number, default: 0, min: 0 },
    remainingBalanceEgp: { type: Number, required: true, min: 0 },
    paymentSchedule: [
      {
        dueDate: { type: Date, required: true },
        amount: { type: Number, required: true, min: 0 },
        status: { type: String, enum: ["PENDING", "PAID", "OVERDUE"], default: "PENDING" },
      },
    ],
    attachments: [{ type: String }],
    status: {
      type: String,
      enum: ["ACTIVE", "PARTIALLY_RELEASED", "COMPLETED", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

wholesaleContractSchema.index({ tripId: 1, status: 1 });

export const WholesaleContractModel =
  (mongoose.models.WholesaleContract as mongoose.Model<IWholesaleContract>) ||
  mongoose.model<IWholesaleContract>("WholesaleContract", wholesaleContractSchema);
export type HWholesaleContract = HydratedDocument<IWholesaleContract>;
