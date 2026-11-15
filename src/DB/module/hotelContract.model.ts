import mongoose, { HydratedDocument } from "mongoose";

export type HotelCity = string;
export type HotelPricingMode = "FLAT_RATE" | "TIERED_RATE";

export interface IHotel {
  _id?: mongoose.Types.ObjectId;
  nameAr: string;
  nameEn: string;
  city: string;
  country?: string | undefined;
  stars: number;
  distanceToHaramMeters?: number | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  status: "ACTIVE" | "INACTIVE";
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const hotelSchema = new mongoose.Schema<IHotel>(
  {
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    city: { type: String, required: true, uppercase: true, trim: true, index: true },
    country: { type: String, uppercase: true, trim: true, default: "EG" },
    stars: { type: Number, min: 1, max: 7, default: 4 },
    distanceToHaramMeters: { type: Number, min: 0 },
    address: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

export const HotelModel =
  (mongoose.models.Hotel as mongoose.Model<IHotel>) || mongoose.model<IHotel>("Hotel", hotelSchema);
export type HHotel = HydratedDocument<IHotel>;

/**
 * Hotel Contract Pricing Policy:
 * - Currency is SAR by default.
 * - FLAT_RATE: A single nightly room rate (`flatRoomRatePerNight`) is specified.
 *   Total stay room cost = flatRoomRatePerNight * nights.
 *   Derived per-person stay rates:
 *     - doublePerPersonStayRate = Money.divide(flatRoomRatePerNight * nights, 2)
 *     - triplePerPersonStayRate = Money.divide(flatRoomRatePerNight * nights, 3)
 *     - quadPerPersonStayRate   = Money.divide(flatRoomRatePerNight * nights, 4)
 * - TIERED_RATE: Separate nightly room rates (`doubleRoomRatePerNight`, `tripleRoomRatePerNight`, `quadRoomRatePerNight`).
 *   Derived per-person stay rates:
 *     - doublePerPersonStayRate = Money.divide(doubleRoomRatePerNight * nights, 2)
 *     - triplePerPersonStayRate = Money.divide(tripleRoomRatePerNight * nights, 3)
 *     - quadPerPersonStayRate   = Money.divide(quadRoomRatePerNight * nights, 4)
 */
export interface IHotelContractAmendment {
  amendedAt: Date;
  amendedBy?: mongoose.Types.ObjectId | undefined;
  reason: string;
  previousValue: number;
  newValue: number;
  metadata?: Record<string, any> | undefined;
}

export interface IHotelContract {
  _id?: mongoose.Types.ObjectId;
  contractNumber: string;
  hotelId: mongoose.Types.ObjectId;
  supplierId: mongoose.Types.ObjectId;
  city: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  roomCapacities: {
    singleRooms?: number | undefined;
    doubleRooms: number;
    tripleRooms: number;
    quadRooms: number;
    totalRooms: number;
    totalBeds: number;
  };
  allocatedRooms: {
    singleRooms?: number | undefined;
    doubleRooms: number;
    tripleRooms: number;
    quadRooms: number;
  };
  pricingMode: HotelPricingMode;
  currency: "SAR" | "EGP" | "USD" | "EUR";
  rates: {
    flatRoomRatePerNight?: number | undefined;
    singleRoomRatePerNight?: number | undefined;
    doubleRoomRatePerNight: number;
    tripleRoomRatePerNight: number;
    quadRoomRatePerNight: number;
    // Derived Per-Person Rates for the full stay (nights)
    singlePerPersonPerNight?: number | undefined;
    doublePerPersonPerNight: number;
    triplePerPersonPerNight: number;
    quadPerPersonPerNight: number;
    singlePerPersonStayRate?: number | undefined;
    doublePerPersonStayRate: number;
    triplePerPersonStayRate: number;
    quadPerPersonStayRate: number;
  };
  contractValue: number;
  paidAmount: number;
  remainingLiability: number;
  paymentTerms?: string | undefined;
  dueDate?: Date | undefined;
  amendments: IHotelContractAmendment[];
  attachments: string[];
  status: "DRAFT" | "ACTIVE" | "AMENDED" | "COMPLETED" | "CANCELLED";
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const hotelContractSchema = new mongoose.Schema<IHotelContract>(
  {
    contractNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    hotelId: { type: mongoose.Schema.Types.ObjectId, ref: "Hotel", required: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
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
        amendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        reason: { type: String, required: true },
        previousValue: { type: Number, required: true },
        newValue: { type: Number, required: true },
        metadata: { type: mongoose.Schema.Types.Mixed },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

hotelContractSchema.index({ city: 1, checkIn: 1, checkOut: 1 });

export const HotelContractModel =
  (mongoose.models.HotelContract as mongoose.Model<IHotelContract>) ||
  mongoose.model<IHotelContract>("HotelContract", hotelContractSchema);
export type HHotelContract = HydratedDocument<IHotelContract>;
