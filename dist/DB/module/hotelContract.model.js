"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotelContractModel = exports.HotelModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const hotelSchema = new mongoose_1.default.Schema({
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    city: { type: String, required: true, uppercase: true, trim: true, index: true },
    country: { type: String, uppercase: true, trim: true, default: "EG" },
    stars: { type: Number, min: 1, max: 7, default: 4 },
    distanceToHaramMeters: { type: Number, min: 0 },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
exports.HotelModel = mongoose_1.default.models.Hotel || mongoose_1.default.model("Hotel", hotelSchema);
const hotelContractSchema = new mongoose_1.default.Schema({
    contractNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    hotelId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    supplierId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    city: { type: String, required: true, uppercase: true, trim: true, index: true },
    checkIn: { type: Date, required: true, index: true },
    checkOut: { type: Date, required: true, index: true },
    nights: { type: Number, required: true, min: 1 },
    roomCapacities: {
        singleRooms: { type: Number, default: 0, min: 0 },
        doubleRooms: { type: Number, required: true, default: 0, min: 0 },
        tripleRooms: { type: Number, required: true, default: 0, min: 0 },
        quadRooms: { type: Number, required: true, default: 0, min: 0 },
        totalRooms: { type: Number, required: true, min: 1 },
        totalBeds: { type: Number, required: true, min: 1 },
    },
    allocatedRooms: {
        singleRooms: { type: Number, default: 0, min: 0 },
        doubleRooms: { type: Number, default: 0, min: 0 },
        tripleRooms: { type: Number, default: 0, min: 0 },
        quadRooms: { type: Number, default: 0, min: 0 },
    },
    pricingMode: { type: String, enum: ["FLAT_RATE", "TIERED_RATE"], required: true },
    currency: { type: String, enum: ["SAR", "EGP", "USD", "EUR"], default: "SAR" },
    rates: {
        flatRoomRatePerNight: { type: Number, min: 0 },
        singleRoomRatePerNight: { type: Number, default: 0, min: 0 },
        doubleRoomRatePerNight: { type: Number, required: true, min: 0 },
        tripleRoomRatePerNight: { type: Number, required: true, min: 0 },
        quadRoomRatePerNight: { type: Number, required: true, min: 0 },
        singlePerPersonPerNight: { type: Number, default: 0, min: 0 },
        doublePerPersonPerNight: { type: Number, required: true, min: 0 },
        triplePerPersonPerNight: { type: Number, required: true, min: 0 },
        quadPerPersonPerNight: { type: Number, required: true, min: 0 },
        singlePerPersonStayRate: { type: Number, default: 0, min: 0 },
        doublePerPersonStayRate: { type: Number, required: true, min: 0 },
        triplePerPersonStayRate: { type: Number, required: true, min: 0 },
        quadPerPersonStayRate: { type: Number, required: true, min: 0 },
    },
    contractValue: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    remainingLiability: { type: Number, required: true, min: 0 },
    paymentTerms: { type: String, trim: true },
    dueDate: { type: Date },
    amendments: [
        {
            amendedAt: { type: Date, default: Date.now },
            amendedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
            reason: { type: String, required: true },
            previousValue: { type: Number, required: true },
            newValue: { type: Number, required: true },
            metadata: { type: mongoose_1.default.Schema.Types.Mixed },
        },
    ],
    attachments: [{ type: String }],
    status: {
        type: String,
        enum: ["DRAFT", "ACTIVE", "AMENDED", "COMPLETED", "CANCELLED"],
        default: "ACTIVE",
        index: true,
    },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
hotelContractSchema.index({ city: 1, checkIn: 1, checkOut: 1 });
exports.HotelContractModel = mongoose_1.default.models.HotelContract ||
    mongoose_1.default.model("HotelContract", hotelContractSchema);
