"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryption = exports.encryption = void 0;
const crypto_1 = __importDefault(require("crypto"));
const config_js_1 = require("../../config.js");
const KEY = Buffer.from(config_js_1.ENC_KEY, "hex");
const encryption = async (plainText) => {
    const iv = crypto_1.default.randomBytes(config_js_1.IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv("aes-256-cbc", KEY, iv);
    let encryptedData = cipher.update(plainText, "utf-8", "hex");
    encryptedData += cipher.final("hex");
    return `${iv.toString("hex")}::${encryptedData}`;
};
exports.encryption = encryption;
const decryption = async (ciperText) => {
    const [iv, encryptedText] = ciperText.split("::");
    const binaryLikeIv = Buffer.from(iv, "hex");
    const decipher = crypto_1.default.createDecipheriv("aes-256-cbc", KEY, binaryLikeIv);
    let decryptedData = decipher.update(encryptedText, "hex", "utf8");
    decryptedData += decipher.final("utf-8");
    return decryptedData;
};
exports.decryption = decryption;
