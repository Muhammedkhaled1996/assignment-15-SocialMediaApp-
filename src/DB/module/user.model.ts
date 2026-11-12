import mongoose, { HydratedDocument } from "mongoose";
import { GenderEnum, providerEnum, UserRole } from "../../common/enum";
import { IUser } from "../../common/interface/user.interface";
import { FollowStatus } from "../../common/enum/followStatus.enum";
import { encryption, hashed } from "../../common/security";

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
    followers: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: Number, enum: FollowStatus, default: FollowStatus.PENDING },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    followings: [
      {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        status: { type: Number, enum: FollowStatus, default: FollowStatus.PENDING },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isPrivate: { type: Boolean, default: false },
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

// hash password and encrypt phone number hook
userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await hashed({ plainText: this.password });
  }
  if (this.isModified("phone")) {
    this.phone = await encryption(this.phone as string);
  }
});

userSchema.pre(["find", "findOne"], function () {
  const query = this.getFilter();

  if (query.paranoid != false) {
    this.setQuery({ ...query, deletedAt: { $exists: false } });
  }
});

userSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  const query = this.getFilter();

  if (query.paranoid != false) {
    this.setQuery({ ...query, deletedAt: { $exists: false } });
  }
});

userSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function () {
  const query = { ...this.getFilter() };

  if (query.force) {
    this.setQuery(query);
  } else {
    this.setQuery({
      ...query,
      deletedAt: { $exists: true, $ne: null },
    });
  }
});

export const UserModel = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
export type HUser = HydratedDocument<IUser>;
