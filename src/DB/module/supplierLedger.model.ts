import mongoose, { HydratedDocument } from "mongoose";

export type SupplierLedgerEntryType =
  | "OPENING_BALANCE"
  | "CONTRACT_OBLIGATION"
  | "DEPOSIT"
  | "PARTIAL_PAYMENT"
  | "FULL_PAYMENT"
  | "CREDIT_NOTE"
  | "ADJUSTMENT";

export interface ISupplierLedgerEntry {
  _id?: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  entryType: SupplierLedgerEntryType;
  referenceType: "SUPPLIER" | "FLIGHT_LOT" | "HOTEL_CONTRACT" | "PAYMENT_VOUCHER" | "MANUAL_ADJUSTMENT" | "TRIP";
  referenceId: mongoose.Types.ObjectId;
  referenceNumber?: string | undefined;
  description: string;
  currency: "EGP" | "SAR" | "USD" | "EUR";
  debitAmount: number; // reduces liability (payments, deposits, credit notes)
  creditAmount: number; // increases liability (opening balance, contract obligations)
  runningBalance: number;
  exchangeRateToEgp: number;
  amountInEgp: number;
  dueDate?: Date | undefined;
  isPaid?: boolean | undefined;
  effectiveDate: Date;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const supplierLedgerEntrySchema = new mongoose.Schema<ISupplierLedgerEntry>(
  {
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", index: true },
    entryType: {
      type: String,
      enum: [
        "OPENING_BALANCE",
        "CONTRACT_OBLIGATION",
        "DEPOSIT",
        "PARTIAL_PAYMENT",
        "FULL_PAYMENT",
        "CREDIT_NOTE",
        "ADJUSTMENT",
      ],
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
      enum: ["SUPPLIER", "FLIGHT_LOT", "HOTEL_CONTRACT", "PAYMENT_VOUCHER", "MANUAL_ADJUSTMENT", "TRIP"],
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    referenceNumber: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    currency: { type: String, enum: ["EGP", "SAR", "USD", "EUR"], required: true },
    debitAmount: { type: Number, required: true, default: 0, min: 0 },
    creditAmount: { type: Number, required: true, default: 0, min: 0 },
    runningBalance: { type: Number, required: true },
    exchangeRateToEgp: { type: Number, default: 1, min: 0 },
    amountInEgp: { type: Number, required: true },
    dueDate: { type: Date, index: true },
    isPaid: { type: Boolean, default: false, index: true },
    effectiveDate: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

supplierLedgerEntrySchema.index({ supplierId: 1, effectiveDate: 1, _id: 1 });
supplierLedgerEntrySchema.index({ supplierId: 1, dueDate: 1, isPaid: 1 });

export const SupplierLedgerEntryModel =
  (mongoose.models.SupplierLedgerEntry as mongoose.Model<ISupplierLedgerEntry>) ||
  mongoose.model<ISupplierLedgerEntry>("SupplierLedgerEntry", supplierLedgerEntrySchema);
export type HSupplierLedgerEntry = HydratedDocument<ISupplierLedgerEntry>;
