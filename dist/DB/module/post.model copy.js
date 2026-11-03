"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const userSchema = new mongoose_1.default.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, minLength: 2, maxLength: 25 },
    images: [String],
    likes: [
        {
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            createdAt: { type: Date, default: Date.now },
        },
    ],
    comments: [
        {
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
        },
    ],
    shares: [
        {
            userId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            createdAt: { type: Date, default: Date.now },
        },
    ],
}, {
    timestamps: true,
    autoIndex: true,
    strict: true,
    strictQuery: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
exports.PostModel = mongoose_1.default.models.Post || mongoose_1.default.model("Post", userSchema);
