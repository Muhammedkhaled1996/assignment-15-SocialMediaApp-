import mongoose, { HydratedDocument } from "mongoose";

export type SupplierType = "AIRLINE" | "BROKER" | "HOTEL" | "SAUDI_AGENT" | "TRANSPORT" | "OTHER";

export interface ISupplier {
  _id?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId | undefined;
  code: string;
  nameAr: string;
  nameEn: string;
  type: SupplierType;
  contactPerson?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  country?: string | undefined;
  taxNumber?: string | undefined;
  commercialRegister?: string | undefined;
  bankDetails?: {
    bankName?: string | undefined;
    accountName?: string | undefined;
    accountNumber?: string | undefined;
    iban?: string | undefined;
    swiftCode?: string | undefined;
  } | undefined;
  currency: "EGP" | "SAR" | "USD" | "EUR";
  openingBalance: number; // positive = we owe supplier (credit liability)
  totalObligations: number;
  totalPayments: number;
  currentBalance: number; // openingBalance + totalObligations - totalPayments
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const supplierSchema = new mongoose.Schema<ISupplier>(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["AIRLINE", "BROKER", "HOTEL", "SAUDI_AGENT", "TRANSPORT", "OTHER"],
      required: true,
      index: true,
    },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    country: { type: String, trim: true, default: "SA" },
    taxNumber: { type: String, trim: true },
    commercialRegister: { type: String, trim: true },
    bankDetails: {
      bankName: { type: String, trim: true },
      accountName: { type: String, trim: true },
      accountNumber: { type: String, trim: true },
      iban: { type: String, trim: true },
      swiftCode: { type: String, trim: true },
    },
    currency: { type: String, enum: ["EGP", "SAR", "USD", "EUR"], default: "SAR", index: true },
    openingBalance: { type: Number, default: 0 },
    totalObligations: { type: Number, default: 0 },
    totalPayments: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE", index: true },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

supplierSchema.index({ type: 1, status: 1 });

export const SupplierModel =
  (mongoose.models.Supplier as mongoose.Model<ISupplier>) || mongoose.model<ISupplier>("Supplier", supplierSchema);
export type HSupplier = HydratedDocument<ISupplier>;
