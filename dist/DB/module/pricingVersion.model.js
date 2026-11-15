"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingVersionModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const categorySchema = new mongoose_1.default.Schema({
    category: { type: String, enum: ["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"], required: true },
    flightCostEgp: { type: Number, required: true },
    accommodationCostSar: { type: Number, required: true },
    accommodationCostEgp: { type: Number, required: true },
    operationalCostEgp: { type: Number, required: true },
    supervisorShareCostEgp: { type: Number, required: true },
    totalCostPerPassengerEgp: { type: Number, required: true },
    sellingPriceEgp: { type: Number, required: true },
    minimumSellingPriceEgp: { type: Number, required: true },
    profitPerPassengerEgp: { type: Number, required: true },
    profitMarginPercent: { type: Number, required: true },
}, { _id: false });
const pricingVersionSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    versionNumber: { type: Number, required: true, default: 1 },
    exchangeRateSarToEgp: { type: Number, required: true, min: 0.0001 },
    groupCapacity: { type: Number, required: true, min: 1 },
    inputs: {
        flightCostPerSeatEgp: { type: Number, required: true, min: 0 },
        makkahHotelPerPersonStaySar: {
            single: { type: Number, min: 0 },
            double: { type: Number, required: true, min: 0 },
            triple: { type: Number, required: true, min: 0 },
            quad: { type: Number, required: true, min: 0 },
        },
        madinahHotelPerPersonStaySar: {
            single: { type: Number, min: 0 },
            double: { type: Number, required: true, min: 0 },
            triple: { type: Number, required: true, min: 0 },
            quad: { type: Number, required: true, min: 0 },
        },
        saudiAgentFeeSar: { type: Number, default: 0, min: 0 },
        transportCostSar: { type: Number, default: 0, min: 0 },
        barcodeFeeEgp: { type: Number, default: 0, min: 0 },
        giftsCostEgp: { type: Number, default: 0, min: 0 },
        otherOperationalCostEgp: { type: Number, default: 0, min: 0 },
        supervisorFlightTicketEgp: { type: Number, default: 0, min: 0 },
        supervisorAccommodationSar: { type: Number, default: 0, min: 0 },
        supervisorGratuitiesEgp: { type: Number, default: 0, min: 0 },
        targetProfitMarginPercent: { type: Number, default: 15, min: 0 },
        maxDiscountPercentAllowed: { type: Number, default: 5, min: 0, max: 100 },
        childPolicy: {
            flightCostMultiplier: { type: Number, default: 0.8 },
            includeAccommodation: { type: Boolean, default: false },
            sellingPriceOverrideEgp: { type: Number },
        },
        infantPolicy: {
            flightCostMultiplier: { type: Number, default: 0.2 },
            visaAndAgentFeeSar: { type: Number, default: 500 },
            sellingPriceOverrideEgp: { type: Number },
        },
    },
    totals: {
        totalFlightCostEgp: { type: Number, required: true },
        totalOperationalCostEgp: { type: Number, required: true },
        totalSupervisorCostEgp: { type: Number, required: true },
        supervisorCostPerPassengerEgp: { type: Number, required: true },
        estimatedTotalGroupCostEgp: { type: Number, required: true },
        estimatedTotalGroupRevenueEgp: { type: Number, required: true },
        expectedGroupProfitEgp: { type: Number, required: true },
        expectedGroupProfitMarginPercent: { type: Number, required: true },
    },
    categories: {
        SINGLE: { type: categorySchema },
        DOUBLE: { type: categorySchema, required: true },
        TRIPLE: { type: categorySchema, required: true },
        QUAD: { type: categorySchema, required: true },
        CHILD: { type: categorySchema, required: true },
        INFANT: { type: categorySchema, required: true },
    },
    status: { type: String, enum: ["DRAFT", "APPROVED", "SUPERSEDED", "ARCHIVED"], default: "DRAFT", index: true },
    approvedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
pricingVersionSchema.index({ tripId: 1, status: 1, versionNumber: -1 });
exports.PricingVersionModel = mongoose_1.default.models.PricingVersion ||
    mongoose_1.default.model("PricingVersion", pricingVersionSchema);
