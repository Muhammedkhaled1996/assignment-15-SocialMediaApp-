import mongoose, { HydratedDocument } from "mongoose";

export interface IBranch {
  _id?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId | undefined;
  code: string;
  nameAr: string;
  nameEn: string;
  governorate: string;
  city?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  managerId?: mongoose.Types.ObjectId | undefined;
  isHeadquarters: boolean;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  deletedAt?: Date | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const branchSchema = new mongoose.Schema<IBranch>(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    governorate: { type: String, required: true, trim: true },
    city: { type: String, trim: true },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isHeadquarters: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "SUSPENDED"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
  },
  { timestamps: true, strict: true },
);

branchSchema.index({ companyId: 1, status: 1 });

export const BranchModel =
  (mongoose.models.Branch as mongoose.Model<IBranch>) || mongoose.model<IBranch>("Branch", branchSchema);
export type HBranch = HydratedDocument<IBranch>;

