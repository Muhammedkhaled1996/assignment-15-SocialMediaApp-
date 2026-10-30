import mongoose from "mongoose";
import { GenderEnum, providerEnum, UserRole } from "../enum";
import { FollowStatus } from "../enum/followStatus.enum";

export interface IFollowItem {
  id: mongoose.Types.ObjectId;
  status: FollowStatus;
  createdAt: Date;
}

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
  followers?: IFollowItem[] | undefined;
  followings?: IFollowItem[] | undefined;
  isPrivate?: boolean
}
