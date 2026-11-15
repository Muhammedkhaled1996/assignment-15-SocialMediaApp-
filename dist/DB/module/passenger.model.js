"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PassengerModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const passengerSchema = new mongoose_1.default.Schema({
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    arabicName: { type: String, required: true, trim: true, index: true },
    englishName: { type: String, required: true, trim: true, uppercase: true, index: true },
    nationalId: { type: String, required: true, unique: true, trim: true, index: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ["MALE", "FEMALE"], required: true },
    nationality: { type: String, default: "EG", uppercase: true },
    occupation: { type: String, trim: true },
    governorate: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passportNumber: { type: String, unique: true, sparse: true, uppercase: true, trim: true, index: true },
    passportIssueDate: { type: Date },
    passportExpirationDate: { type: Date, index: true },
    passportAttachments: [{ type: String }],
    emergencyContact: {
        name: { type: String, trim: true },
        relation: { type: String, trim: true },
        phone: { type: String, trim: true },
    },
    mahramPassengerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Passenger", default: null },
    mahramRelationship: { type: String, trim: true },
    familyGroupCode: { type: String, trim: true, uppercase: true, index: true },
    ocrStatus: { type: String, enum: ["MANUAL", "UNVERIFIED_OCR", "VERIFIED"], default: "MANUAL" },
    ocrRawDraft: { type: mongoose_1.default.Schema.Types.Mixed, default: null },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
passengerSchema.index({ branchId: 1, createdAt: -1 });
passengerSchema.index({ branchId: 1, familyGroupCode: 1 });
exports.PassengerModel = mongoose_1.default.models.Passenger ||
    mongoose_1.default.model("Passenger", passengerSchema);
