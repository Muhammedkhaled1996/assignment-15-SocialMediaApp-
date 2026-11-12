"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const enum_1 = require("../../common/enum");
const followStatus_enum_1 = require("../../common/enum/followStatus.enum");
const security_1 = require("../../common/security");
const userSchema = new mongoose_1.default.Schema({
    firstName: { type: String, required: true, minLength: 2, maxLength: 25 },
    lastName: { type: String, required: true, minLength: 2, maxLength: 25 },
    email: { type: String, required: true, unique: true },
    password: {
        type: String,
        required: function () {
            return this.provider == enum_1.providerEnum.SYSTEM;
        },
    },
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
    coverImage: [String],
    role: {
        type: Number,
        default: enum_1.UserRole.user,
        enum: enum_1.UserRole,
    },
    provider: {
        type: Number,
        enum: enum_1.providerEnum,
        default: enum_1.providerEnum.SYSTEM,
    },
    changeCredentialsTime: Date,
    followers: [
        {
            id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            status: { type: Number, enum: followStatus_enum_1.FollowStatus, default: followStatus_enum_1.FollowStatus.PENDING },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    followings: [
        {
            id: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            status: { type: Number, enum: followStatus_enum_1.FollowStatus, default: followStatus_enum_1.FollowStatus.PENDING },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    isPrivate: { type: Boolean, default: false },
}, {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
userSchema
    .virtual("userName")
    .set(function (value) {
    if (!value || typeof value !== "string")
        return;
    const [firstName, lastName] = value.trim().split(" ");
    this.set({
        firstName: firstName || this.firstName,
        lastName: lastName || this.lastName,
    });
})
    .get(function () {
    return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});
userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        this.password = await (0, security_1.hashed)({ plainText: this.password });
    }
    if (this.isModified("phone")) {
        this.phone = await (0, security_1.encryption)(this.phone);
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
    }
    else {
        this.setQuery({
            ...query,
            deletedAt: { $exists: true, $ne: null },
        });
    }
});
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model("User", userSchema);
