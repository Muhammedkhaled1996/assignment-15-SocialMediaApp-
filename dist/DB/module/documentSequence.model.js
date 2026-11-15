"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentSequenceModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const documentSequenceSchema = new mongoose_1.default.Schema({
    key: { type: String, required: true, unique: true, index: true },
    documentType: { type: String, required: true, index: true },
    prefix: { type: String, required: true },
    branchCode: { type: String, default: "HQ" },
    year: { type: Number, required: true },
    currentValue: { type: Number, required: true, default: 0 },
    padding: { type: Number, default: 6 },
}, { timestamps: true, strict: true });
exports.DocumentSequenceModel = mongoose_1.default.models.DocumentSequence ||
    mongoose_1.default.model("DocumentSequence", documentSequenceSchema);
