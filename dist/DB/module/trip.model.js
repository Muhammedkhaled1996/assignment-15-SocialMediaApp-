"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupModel = exports.TripModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const tripSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    tripCategory: {
        type: String,
        enum: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"],
        default: "RELIGIOUS",
        index: true,
    },
    transportType: {
        type: String,
        enum: ["FLIGHT", "BUS", "CRUISE", "TRAIN", "NONE"],
        default: "FLIGHT",
    },
    season: { type: String, required: true, trim: true, index: true },
    destination: { type: String, required: true, default: "MAKKAH_MADINAH", index: true },
    coverImage: { type: String, trim: true },
    galleryImages: [{ type: String, trim: true }],
    itinerary: [
        {
            dayNumber: { type: Number, required: true, min: 1 },
            titleAr: { type: String, required: true, trim: true },
            titleEn: { type: String, trim: true },
            descriptionAr: { type: String, required: true, trim: true },
            descriptionEn: { type: String, trim: true },
            meals: [{ type: String, trim: true }],
            activities: [{ type: String, trim: true }],
        },
    ],
    departureDate: { type: Date, required: true, index: true },
    returnDate: { type: Date, required: true, index: true },
    flightAllocations: [
        {
            flightLotId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "FlightLot", required: true },
            allocatedSeats: { type: Number, required: true, min: 1 },
        },
    ],
    hotelAllocations: [
        {
            hotelContractId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "HotelContract", required: true },
            city: { type: String, required: true, uppercase: true, trim: true },
            singleRooms: { type: Number, default: 0, min: 0 },
            doubleRooms: { type: Number, default: 0, min: 0 },
            tripleRooms: { type: Number, default: 0, min: 0 },
            quadRooms: { type: Number, default: 0, min: 0 },
        },
    ],
    capacity: { type: Number, required: true, min: 1 },
    availableInventory: { type: Number, required: true, min: 0 },
    allocatedToBranchesSeats: { type: Number, required: true, default: 0, min: 0 },
    wholesaleAllocatedSeats: { type: Number, required: true, default: 0, min: 0 },
    reservedSeats: { type: Number, required: true, default: 0, min: 0 },
    confirmedSoldSeats: { type: Number, required: true, default: 0, min: 0 },
    approvedPricingVersionId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "PricingVersion", default: null },
    quotaMode: { type: String, enum: ["SHARED_QUOTA", "ALLOCATED_QUOTA"], required: true, default: "SHARED_QUOTA" },
    bookingWindow: {
        opensAt: { type: Date },
        closesAt: { type: Date },
    },
    includedServices: [{ type: String }],
    requiredDocuments: [{ type: String }],
    status: {
        type: String,
        enum: ["DRAFT", "PUBLISHED", "OPEN_FOR_BOOKING", "CLOSED", "DEPARTED", "COMPLETED", "CANCELLED"],
        default: "OPEN_FOR_BOOKING",
        index: true,
    },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
tripSchema.index({ departureDate: 1, status: 1 });
tripSchema.index({ season: 1, status: 1 });
exports.TripModel = mongoose_1.default.models.Trip || mongoose_1.default.model("Trip", tripSchema);
const groupSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    supervisorName: { type: String, trim: true },
    supervisorPhone: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    assignedPassengersCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "LOCKED", "COMPLETED"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
exports.GroupModel = mongoose_1.default.models.Group || mongoose_1.default.model("Group", groupSchema);
