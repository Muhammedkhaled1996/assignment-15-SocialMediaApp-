"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const enum_1 = require("../../common/enum");
const security_1 = require("../../common/security");
const userSchema = new mongoose_1.default.Schema({
    firstName: { type: String, required: true, minLength: 2, maxLength: 50 },
    lastName: { type: String, required: true, minLength: 2, maxLength: 50 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    roleNumber: {
        type: Number,
        enum: enum_1.ALL_USER_ROLES,
        default: enum_1.UserRole.EMPLOYEE,
        required: true,
        index: true,
    },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    isActive: { type: Boolean, default: true, index: true },
    phone: String,
    gender: {
        type: Number,
        enum: enum_1.GenderEnum,
        default: enum_1.GenderEnum.MALE,
    },
    DOB: Date,
    confirmEmail: Date,
    deletedAt: Date,
    image: String,
    changeCredentialsTime: Date,
    companyId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Company", index: true },
    primaryBranchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    assignedBranchIds: [{ type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch" }],
    canAccessAllBranches: { type: Boolean, default: false },
    accountStatus: {
        type: String,
        enum: Object.values(enum_1.UserAccountStatus),
        default: enum_1.UserAccountStatus.ACTIVE,
        index: true,
    },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    lastLoginAt: { type: Date },
    employeeCode: { type: String, trim: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
userSchema.index({ branchId: 1, roleNumber: 1, isActive: 1 });
userSchema.index({ assignedBranchIds: 1, accountStatus: 1 });
userSchema
    .virtual("userName")
    .set(function (value) {
    if (!value || typeof value !== "string")
        return;
    const parts = value.trim().split(/\s+/);
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
    if (!value || typeof value !== "string")
        return;
    const parts = value.trim().split(/\s+/);
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
    return enum_1.USER_ROLE_LABELS[this.roleNumber] || "EMPLOYEE";
});
userSchema.pre("validate", function () {
    if (this.branchId && !this.primaryBranchId) {
        this.primaryBranchId = this.branchId;
    }
    else if (this.primaryBranchId && !this.branchId) {
        this.branchId = this.primaryBranchId;
    }
    if (this.branchId) {
        const existingIds = Array.isArray(this.assignedBranchIds) ? this.assignedBranchIds.map((id) => id.toString()) : [];
        if (!existingIds.includes(this.branchId.toString())) {
            this.assignedBranchIds = [...(this.assignedBranchIds || []), this.branchId];
        }
    }
    if (this.isModified("accountStatus")) {
        this.isActive = this.accountStatus === enum_1.UserAccountStatus.ACTIVE;
    }
    else if (this.isModified("isActive")) {
        if (!this.isActive && this.accountStatus === enum_1.UserAccountStatus.ACTIVE) {
            this.accountStatus = enum_1.UserAccountStatus.SUSPENDED;
        }
        else if (this.isActive && this.accountStatus !== enum_1.UserAccountStatus.ACTIVE) {
            this.accountStatus = enum_1.UserAccountStatus.ACTIVE;
        }
    }
});
userSchema.pre("save", async function () {
    if (this.isModified("password") && this.password && !this.password.startsWith("$argon2")) {
        this.password = await (0, security_1.hashed)({ plainText: this.password });
    }
    if (this.isModified("phone") && this.phone && !this.phone.includes("::")) {
        this.phone = await (0, security_1.encryption)(this.phone);
    }
});
userSchema.pre(["find", "findOne", "countDocuments"], function () {
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
    }
    else {
        this.setQuery({
            ...query,
            deletedAt: { $exists: true, $ne: null },
        });
    }
});
userSchema.post(["find", "findOne", "findOneAndUpdate"], async function (result) {
    if (!result)
        return;
    if (Array.isArray(result)) {
        for (const doc of result) {
            if (doc?.phone && typeof doc.phone === "string" && doc.phone.includes("::")) {
                doc.phone = await (0, security_1.decryption)(doc.phone);
            }
        }
    }
    else if (result?.phone && typeof result.phone === "string" && result.phone.includes("::")) {
        result.phone = await (0, security_1.decryption)(result.phone);
    }
});
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model("User", userSchema);
