import mongoose, { HydratedDocument } from "mongoose";

export type SequenceDocumentType =
  | "BOOKING"
  | "RECEIPT"
  | "PAYMENT_VOUCHER"
  | "EXPENSE"
  | "TRANSFER"
  | "CONTRACT"
  | "JOURNAL_ENTRY"
  | "MANIFEST"
  | "TRIP"
  | "WHOLESALE";

export interface IDocumentSequence {
  _id?: mongoose.Types.ObjectId;
  key: string; // e.g. "BOOKING:CAI:2026"
  documentType: SequenceDocumentType;
  prefix: string;
  branchCode: string;
  year: number;
  currentValue: number;
  padding: number;
  updatedAt?: Date;
}

const documentSequenceSchema = new mongoose.Schema<IDocumentSequence>(
  {
    key: { type: String, required: true, unique: true, index: true },
    documentType: { type: String, required: true, index: true },
    prefix: { type: String, required: true },
    branchCode: { type: String, default: "HQ" },
    year: { type: Number, required: true },
    currentValue: { type: Number, required: true, default: 0 },
    padding: { type: Number, default: 6 },
  },
  { timestamps: true, strict: true },
);

export const DocumentSequenceModel =
  (mongoose.models.DocumentSequence as mongoose.Model<IDocumentSequence>) ||
  mongoose.model<IDocumentSequence>("DocumentSequence", documentSequenceSchema);
export type HDocumentSequence = HydratedDocument<IDocumentSequence>;

