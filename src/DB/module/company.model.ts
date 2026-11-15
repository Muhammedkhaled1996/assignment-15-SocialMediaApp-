import mongoose, { HydratedDocument } from "mongoose";

export type TourismCategory = "DOMESTIC" | "RELIGIOUS" | "OUTBOUND";

export interface ICompany {
  _id?: mongoose.Types.ObjectId;
  nameAr: string;
  nameEn: string;
  code: string;
  logoUrl?: string | undefined;
  primaryColor?: string | undefined;
  secondaryColor?: string | undefined;
  website?: string | undefined;
  supportedTourismTypes?: TourismCategory[] | undefined;
  taxNumber?: string | undefined;
  commercialRegister?: string | undefined;
  tourismLicenseNumber?: string | undefined;
  baseCurrency: string;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  status: "ACTIVE" | "INACTIVE";
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const companySchema = new mongoose.Schema<ICompany>(
  {
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    logoUrl: { type: String, trim: true },
    primaryColor: { type: String, trim: true, default: "#0F172A" },
    secondaryColor: { type: String, trim: true, default: "#D97706" },
    website: { type: String, trim: true },
    supportedTourismTypes: {
      type: [{ type: String, enum: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"] }],
      default: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"],
    },
    taxNumber: { type: String, trim: true },
    commercialRegister: { type: String, trim: true },
    tourismLicenseNumber: { type: String, trim: true },
    baseCurrency: { type: String, default: "EGP", uppercase: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

export const CompanyModel =
  (mongoose.models.Company as mongoose.Model<ICompany>) || mongoose.model<ICompany>("Company", companySchema);
export type HCompany = HydratedDocument<ICompany>;

