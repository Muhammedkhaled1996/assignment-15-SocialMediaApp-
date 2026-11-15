import mongoose, { HydratedDocument } from "mongoose";

export interface IPassenger {
  _id?: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  arabicName: string;
  englishName: string;
  nationalId: string; // 14-digit Egyptian National ID
  dateOfBirth: Date;
  gender: "MALE" | "FEMALE";
  nationality: string;
  occupation?: string | undefined;
  governorate: string;
  phone: string;
  passportNumber?: string | undefined;
  passportIssueDate?: Date | undefined;
  passportExpirationDate?: Date | undefined;
  passportAttachments: string[];
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  } | undefined;
  mahramPassengerId?: mongoose.Types.ObjectId | null | undefined;
  mahramRelationship?: string | undefined;
  familyGroupCode?: string | undefined;
  ocrStatus: "MANUAL" | "UNVERIFIED_OCR" | "VERIFIED";
  ocrRawDraft?: Record<string, any> | null | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const passengerSchema = new mongoose.Schema<IPassenger>(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    arabicName: { type: String, required: true, trim: true, index: true },
    englishName: { type: String, required: true, trim: true, uppercase: true, index: true },
    nationalId: { type: String, required: true, unique: true, trim: true, index: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["MALE", "FEMALE"], required: true },
    nationality: { type: String, default: "EG", uppercase: true },
    occupation: { type: String, trim: true },
    governorate: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passportNumber: { type: String, unique: true, sparse: true, uppercase: true, trim: true, index: true },
    passportIssueDate: { type: Date },
    passportExpirationDate: { type: Date, index: true },
    passportAttachments: [{ type: String }],
    emergencyContact: {
      name: { type: String, trim: true },
      relation: { type: String, trim: true },
      phone: { type: String, trim: true },
    },
    mahramPassengerId: { type: mongoose.Schema.Types.ObjectId, ref: "Passenger", default: null },
    mahramRelationship: { type: String, trim: true },
    familyGroupCode: { type: String, trim: true, uppercase: true, index: true },
    ocrStatus: { type: String, enum: ["MANUAL", "UNVERIFIED_OCR", "VERIFIED"], default: "MANUAL" },
    ocrRawDraft: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

passengerSchema.index({ branchId: 1, createdAt: -1 });
passengerSchema.index({ branchId: 1, familyGroupCode: 1 });

export const PassengerModel =
  (mongoose.models.Passenger as mongoose.Model<IPassenger>) ||
  mongoose.model<IPassenger>("Passenger", passengerSchema);
export type HPassenger = HydratedDocument<IPassenger>;
