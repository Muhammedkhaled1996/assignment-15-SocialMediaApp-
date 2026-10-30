import mongoose, { HydratedDocument } from "mongoose";
import { GenderEnum, providerEnum, UserRole } from "../../common/enum";
import { IUser } from "../../common/interface/user.interface";
import { FollowStatus } from "../../common/enum/followStatus.enum";

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: { type: String, required: true, minLength: 2, maxLength: 25 },
    lastName: { type: String, required: true, minLength: 2, maxLength: 25 },
    email: { type: String, required: true, unique: true },
    password: {
      type: String,
      required: function (): boolean {
        return this.provider == providerEnum.SYSTEM;
      },
    },
    phone: String,
    gender: {
      type: Number,
      enum: GenderEnum,
      default: GenderEnum.MALE,
    },
    DOB: Date,
    confirmEmail: Date,
    deletedAt: Date,
    image: String,
    coverImage: [String],
    role: {
      type: Number,
      default: UserRole.user,
      enum: UserRole,
    },
    provider: {
      type: Number,
      enum: providerEnum,
      default: providerEnum.SYSTEM,
    },
    changeCredentialsTime: Date,
    followers: [{
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: Number, enum: FollowStatus, default: FollowStatus.PENDING },
      createdAt: { type: Date, default: Date.now }
    }],
    followings: [{
      id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: Number, enum: FollowStatus, default: FollowStatus.PENDING },
      createdAt: { type: Date, default: Date.now }
    }],
    isPrivate: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

userSchema
  .virtual("userName")
  .set(function (value) {
    if (!value || typeof value !== "string") return;
    const [firstName, lastName]: string[] = value.trim().split(" ");
    this.set({
      firstName: firstName || this.firstName,
      lastName: lastName || this.lastName,
    });
  })
  .get(function () {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  });

export const UserModel = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
export type HUser = HydratedDocument<IUser>;
