"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const enum_1 = require("../../common/enum");
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
exports.UserModel = mongoose_1.default.models.User || mongoose_1.default.model("User", userSchema);
