"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.compared = exports.hashed = void 0;
const argon2_1 = __importDefault(require("argon2"));
const hashed = async ({ plainText }) => {
    try {
        const hashedValue = await argon2_1.default.hash(plainText, {
            type: argon2_1.default.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
        return hashedValue;
    }
    catch (error) {
        console.error("Error hashing password:", error);
        throw new Error("Failed to hash password", { cause: { status: 500 } });
    }
};
exports.hashed = hashed;
const compared = async ({ ciperText, plainText }) => {
    try {
        return await argon2_1.default.verify(ciperText, plainText);
    }
    catch (error) {
        console.error("Error verifying password:", error);
        throw new Error("Failed to verify password", { cause: { status: 500 } });
    }
};
exports.compared = compared;
