import mongoose, { HydratedDocument } from "mongoose";

export type TripQuotaMode = "SHARED_QUOTA" | "ALLOCATED_QUOTA";
export type TripStatus = "DRAFT" | "PUBLISHED" | "OPEN_FOR_BOOKING" | "CLOSED" | "DEPARTED" | "COMPLETED" | "CANCELLED";
export type TripCategory = "DOMESTIC" | "RELIGIOUS" | "OUTBOUND";
export type TripTransportType = "FLIGHT" | "BUS" | "CRUISE" | "TRAIN" | "NONE";

export interface ITripItineraryDay {
  dayNumber: number;
  titleAr: string;
  titleEn?: string | undefined;
  descriptionAr: string;
  descriptionEn?: string | undefined;
  meals?: string[] | undefined;
  activities?: string[] | undefined;
}

export interface ITrip {
  _id?: mongoose.Types.ObjectId;
  code: string;
  nameAr: string;
  nameEn: string;
  tripCategory: TripCategory; // "DOMESTIC" (شرم/غردقة/سفاري/فيوم), "RELIGIOUS" (حج/عمرة), "OUTBOUND" (سياحة خارجية ترفيهية)
  transportType: TripTransportType;
  season: string; // e.g. "1448H-RAMADAN" or "SUMMER-2026"
  destination: string; // e.g. "MAKKAH_MADINAH", "SHARM_EL_SHEIKH", "HURGHADA", "ISTANBUL"
  coverImage?: string | undefined;
  galleryImages: string[];
  itinerary: ITripItineraryDay[];
  departureDate: Date;
  returnDate: Date;
  flightAllocations: Array<{
    flightLotId: mongoose.Types.ObjectId;
    allocatedSeats: number;
  }>;
  hotelAllocations: Array<{
    hotelContractId: mongoose.Types.ObjectId;
    city: string;
    singleRooms?: number | undefined;
    doubleRooms: number;
    tripleRooms: number;
    quadRooms: number;
  }>;
  capacity: number;
  availableInventory: number; // Remaining unallocated/unreserved seats in shared pool
  allocatedToBranchesSeats: number; // Total seats assigned to branch quotas in ALLOCATED_QUOTA mode
  wholesaleAllocatedSeats: number; // Seats locked for wholesale contracts
  reservedSeats: number; // Seats currently held/reserved across retail bookings
  confirmedSoldSeats: number; // Confirmed retail passenger bookings
  approvedPricingVersionId?: mongoose.Types.ObjectId | null | undefined;
  quotaMode: TripQuotaMode;
  bookingWindow?: {
    opensAt: Date;
    closesAt: Date;
  } | undefined;
  includedServices: string[];
  requiredDocuments: string[];
  status: TripStatus;
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const tripSchema = new mongoose.Schema<ITrip>(
  {
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
        flightLotId: { type: mongoose.Schema.Types.ObjectId, ref: "FlightLot", required: true },
        allocatedSeats: { type: Number, required: true, min: 1 },
      },
    ],
    hotelAllocations: [
      {
        hotelContractId: { type: mongoose.Schema.Types.ObjectId, ref: "HotelContract", required: true },
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
    approvedPricingVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "PricingVersion", default: null },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

tripSchema.index({ departureDate: 1, status: 1 });
tripSchema.index({ season: 1, status: 1 });

export const TripModel =
  (mongoose.models.Trip as mongoose.Model<ITrip>) || mongoose.model<ITrip>("Trip", tripSchema);
export type HTrip = HydratedDocument<ITrip>;

export interface IGroup {
  _id?: mongoose.Types.ObjectId;
  code: string;
  nameAr: string;
  nameEn: string;
  tripId: mongoose.Types.ObjectId;
  supervisorName?: string | undefined;
  supervisorPhone?: string | undefined;
  capacity: number;
  assignedPassengersCount: number;
  status: "ACTIVE" | "LOCKED" | "COMPLETED";
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const groupSchema = new mongoose.Schema<IGroup>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    supervisorName: { type: String, trim: true },
    supervisorPhone: { type: String, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    assignedPassengersCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "LOCKED", "COMPLETED"], default: "ACTIVE", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

export const GroupModel =
  (mongoose.models.Group as mongoose.Model<IGroup>) || mongoose.model<IGroup>("Group", groupSchema);
export type HGroup = HydratedDocument<IGroup>;
