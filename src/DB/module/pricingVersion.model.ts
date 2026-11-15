import mongoose, { HydratedDocument } from "mongoose";

export type PassengerCategory = "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD" | "CHILD" | "INFANT";

export interface ICategoryPricingBreakdown {
  category: PassengerCategory;
  flightCostEgp: number;
  accommodationCostSar: number;
  accommodationCostEgp: number;
  operationalCostEgp: number;
  supervisorShareCostEgp: number;
  totalCostPerPassengerEgp: number;
  sellingPriceEgp: number;
  minimumSellingPriceEgp: number;
  profitPerPassengerEgp: number;
  profitMarginPercent: number;
}

export interface IPricingVersion {
  _id?: mongoose.Types.ObjectId;
  code: string;
  name: string;
  tripId?: mongoose.Types.ObjectId | null | undefined;
  versionNumber: number;
  exchangeRateSarToEgp: number;
  groupCapacity: number;
  inputs: {
    flightCostPerSeatEgp: number;
    makkahHotelPerPersonStaySar: {
      single?: number | undefined;
      double: number;
      triple: number;
      quad: number;
    };
    madinahHotelPerPersonStaySar: {
      single?: number | undefined;
      double: number;
      triple: number;
      quad: number;
    };
    saudiAgentFeeSar: number;
    transportCostSar: number;
    barcodeFeeEgp: number;
    giftsCostEgp: number;
    otherOperationalCostEgp: number;
    supervisorFlightTicketEgp: number;
    supervisorAccommodationSar: number;
    supervisorGratuitiesEgp: number;
    targetProfitMarginPercent: number;
    maxDiscountPercentAllowed: number;
    childPolicy: {
      flightCostMultiplier: number; // e.g. 0.75 or 1.0
      includeAccommodation: boolean;
      sellingPriceOverrideEgp?: number | undefined;
    };
    infantPolicy: {
      flightCostMultiplier: number; // e.g. 0.15
      visaAndAgentFeeSar: number;
      sellingPriceOverrideEgp?: number | undefined;
    };
  };
  totals: {
    totalFlightCostEgp: number;
    totalOperationalCostEgp: number;
    totalSupervisorCostEgp: number;
    supervisorCostPerPassengerEgp: number;
    estimatedTotalGroupCostEgp: number;
    estimatedTotalGroupRevenueEgp: number;
    expectedGroupProfitEgp: number;
    expectedGroupProfitMarginPercent: number;
  };
  categories: Record<PassengerCategory, ICategoryPricingBreakdown>;
  status: "DRAFT" | "APPROVED" | "SUPERSEDED" | "ARCHIVED";
  approvedBy?: mongoose.Types.ObjectId | undefined;
  approvedAt?: Date | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const categorySchema = new mongoose.Schema<ICategoryPricingBreakdown>(
  {
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
  },
  { _id: false },
);

const pricingVersionSchema = new mongoose.Schema<IPricingVersion>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
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
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

pricingVersionSchema.index({ tripId: 1, status: 1, versionNumber: -1 });

export const PricingVersionModel =
  (mongoose.models.PricingVersion as mongoose.Model<IPricingVersion>) ||
  mongoose.model<IPricingVersion>("PricingVersion", pricingVersionSchema);
export type HPricingVersion = HydratedDocument<IPricingVersion>;
