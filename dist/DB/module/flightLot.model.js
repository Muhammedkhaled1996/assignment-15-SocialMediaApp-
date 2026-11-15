"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlightLotModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const flightLotSchema = new mongoose_1.default.Schema({
    contractReference: { type: String, required: true, unique: true, uppercase: true, trim: true },
    airline: { type: String, required: true, trim: true, index: true },
    airlineCode: { type: String, trim: true, uppercase: true },
    flightNumberOutbound: { type: String, trim: true, uppercase: true },
    flightNumberReturn: { type: String, trim: true, uppercase: true },
    supplierId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    brokerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Supplier", default: null },
    purchaseSource: { type: String, enum: ["DIRECT", "BROKER"], required: true, default: "DIRECT" },
    flightRoute: { type: String, required: true, trim: true },
    departureAirport: { type: String, required: true, uppercase: true, trim: true },
    arrivalAirport: { type: String, required: true, uppercase: true, trim: true },
    returnDepartureAirport: { type: String, uppercase: true, trim: true },
    returnArrivalAirport: { type: String, uppercase: true, trim: true },
    departureDate: { type: Date, required: true, index: true },
    returnDate: { type: Date, required: true, index: true },
    seatQuantity: { type: Number, required: true, min: 1 },
    availableSeats: { type: Number, required: true, min: 0 },
    reservedSeats: { type: Number, required: true, default: 0, min: 0 },
    soldSeats: { type: Number, required: true, default: 0, min: 0 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    remainingLiability: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1, min: 0 },
    paymentTerms: { type: String, trim: true },
    paymentSchedule: [
        {
            dueDate: { type: Date, required: true },
            amount: { type: Number, required: true, min: 0 },
            description: { type: String },
            status: { type: String, enum: ["PENDING", "PARTIAL", "PAID", "OVERDUE"], default: "PENDING" },
            paidAmount: { type: Number, default: 0, min: 0 },
        },
    ],
    attachments: [{ type: String }],
    status: {
        type: String,
        enum: ["DRAFT", "ACTIVE", "DEPLETED", "COMPLETED", "ARCHIVED", "CANCELLED"],
        default: "ACTIVE",
        index: true,
    },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
flightLotSchema.index({ departureDate: 1, status: 1 });
flightLotSchema.index({ supplierId: 1, status: 1 });
exports.FlightLotModel = mongoose_1.default.models.FlightLot ||
    mongoose_1.default.model("FlightLot", flightLotSchema);
