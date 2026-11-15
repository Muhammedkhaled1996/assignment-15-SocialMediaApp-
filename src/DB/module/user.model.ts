import mongoose, { HydratedDocument } from "mongoose";
import { ALL_USER_ROLES, GenderEnum, USER_ROLE_LABELS, UserAccountStatus, UserRole } from "../../common/enum";
import { IUser } from "../../common/interface/user.interface";
import { decryption, encryption, hashed } from "../../common/security";

const userSchema = new mongoose.Schema<IUser>(
  {
    firstName: { type: String, required: true, minLength: 2, maxLength: 50 },
    lastName: { type: String, required: true, minLength: 2, maxLength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    roleNumber: {
      type: Number,
      enum: ALL_USER_ROLES,
      default: UserRole.EMPLOYEE,
      required: true,
      index: true,
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
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
    changeCredentialsTime: Date,

    // Enterprise ERP Multi-Branch & Security Fields
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", index: true },
    primaryBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    assignedBranchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Branch" }],
    canAccessAllBranches: { type: Boolean, default: false },
    accountStatus: {
      type: String,
      enum: Object.values(UserAccountStatus),
      default: UserAccountStatus.ACTIVE,
      index: true,
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date },
    employeeCode: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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

userSchema.index({ branchId: 1, roleNumber: 1, isActive: 1 });
userSchema.index({ assignedBranchIds: 1, accountStatus: 1 });

userSchema
  .virtual("userName")
  .set(function (value) {
    if (!value || typeof value !== "string") return;
    const parts: string[] = value.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || parts[0];
    this.set({
      firstName: firstName || this.firstName,
      lastName: lastName || this.lastName,
    });
  })
  .get(function () {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  });

userSchema
  .virtual("name")
  .set(function (value) {
    if (!value || typeof value !== "string") return;
    const parts: string[] = value.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || parts[0];
    this.set({
      firstName: firstName || this.firstName,
      lastName: lastName || this.lastName,
    });
  })
  .get(function () {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
  });

userSchema.virtual("roleName").get(function () {
  return USER_ROLE_LABELS[this.roleNumber as UserRole] || "EMPLOYEE";
});

userSchema.pre("validate", function () {
  if (this.branchId && !this.primaryBranchId) {
    this.primaryBranchId = this.branchId;
  } else if (this.primaryBranchId && !this.branchId) {
    this.branchId = this.primaryBranchId;
  }
  if (this.branchId) {
    const existingIds = Array.isArray(this.assignedBranchIds) ? this.assignedBranchIds.map((id) => id.toString()) : [];
    if (!existingIds.includes(this.branchId.toString())) {
      this.assignedBranchIds = [...(this.assignedBranchIds || []), this.branchId];
    }
  }
  if (this.isModified("accountStatus")) {
    this.isActive = this.accountStatus === UserAccountStatus.ACTIVE;
  } else if (this.isModified("isActive")) {
    if (!this.isActive && this.accountStatus === UserAccountStatus.ACTIVE) {
      this.accountStatus = UserAccountStatus.SUSPENDED;
    } else if (this.isActive && this.accountStatus !== UserAccountStatus.ACTIVE) {
      this.accountStatus = UserAccountStatus.ACTIVE;
    }
  }
});

userSchema.pre("save", async function () {
  if (this.isModified("password") && this.password && !this.password.startsWith("$argon2")) {
    this.password = await hashed({ plainText: this.password });
  }
  if (this.isModified("phone") && this.phone && !this.phone.includes("::")) {
    this.phone = await encryption(this.phone as string);
  }
});

userSchema.pre(["find", "findOne" , "countDocuments"], function () {
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

userSchema.post(["find", "findOne", "findOneAndUpdate"], async function (result) {
  if (!result) return;

  if (Array.isArray(result)) {
    for (const doc of result) {
      if (doc?.phone && typeof doc.phone === "string" && doc.phone.includes("::")) {
        doc.phone = await decryption(doc.phone);
      }
    }
  } else if (result?.phone && typeof result.phone === "string" && result.phone.includes("::")) {
    result.phone = await decryption(result.phone);
  }
});

export const UserModel = (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>("User", userSchema);
export type HUser = HydratedDocument<IUser>;
