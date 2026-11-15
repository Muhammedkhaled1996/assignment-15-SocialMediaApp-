import mongoose from "mongoose";
import { GenderEnum, UserAccountStatus, UserRole } from "../enum";

export interface IUser {
  id?: string;
  _id?: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  name?: string | undefined;
  userName?: string | undefined;
  email: string;
  password: string;
  confirmPassword?: string | undefined;
  roleNumber: UserRole;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  isActive: boolean;
  phone?: string | undefined;
  gender?: GenderEnum | undefined;
  DOB?: string | undefined;
  confirmEmail?: Date | undefined;
  image?: string | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  deletedAt?: Date | string | null | undefined;
  changeCredentialsTime?: Date | undefined;

  // Enterprise ERP Multi-Branch & Security Fields
  companyId?: mongoose.Types.ObjectId | undefined;
  primaryBranchId?: mongoose.Types.ObjectId | null | undefined;
  assignedBranchIds?: mongoose.Types.ObjectId[] | undefined;
  canAccessAllBranches?: boolean | undefined;
  accountStatus?: UserAccountStatus | undefined;
  failedLoginAttempts?: number | undefined;
  lockUntil?: Date | null | undefined;
  lastLoginAt?: Date | undefined;
  employeeCode?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
}
