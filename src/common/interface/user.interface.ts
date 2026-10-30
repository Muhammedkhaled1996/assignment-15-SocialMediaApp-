import mongoose from "mongoose";
import { GenderEnum, providerEnum, UserRole } from "../enum";

export interface IUser {
  id?: string;
  _id?: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  userName?: string | undefined;
  email: string;
  password: string;
  confirmPassword: string;
  phone?: string | undefined;
  gender?: GenderEnum | undefined;
  DOB?: string | undefined;
  confirmEmail?: Date | undefined;
  image?: string | undefined;
  coverImage?: string[] | undefined;
  role?: UserRole | undefined;
  provider: providerEnum;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
  deletedAt?: string | undefined;
  changeCredentialsTime?: Date | undefined;
}
