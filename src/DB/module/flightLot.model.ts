import mongoose, { HydratedDocument } from "mongoose";

export interface IFlightPaymentScheduleItem {
  dueDate: Date;
  amount: number;
  description?: string | undefined;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  paidAmount: number;
}

export interface IFlightLot {
  _id?: mongoose.Types.ObjectId;
  contractReference: string;
  airline: string;
  airlineCode?: string | undefined;
  flightNumberOutbound?: string | undefined;
  flightNumberReturn?: string | undefined;
  supplierId: mongoose.Types.ObjectId;
  brokerId?: mongoose.Types.ObjectId | null | undefined;
  purchaseSource: "DIRECT" | "BROKER";
  flightRoute: string; // e.g. "CAI-JED-MED-CAI"
  departureAirport: string;
  arrivalAirport: string;
  returnDepartureAirport?: string | undefined;
  returnArrivalAirport?: string | undefined;
  departureDate: Date;
  returnDate: Date;
  seatQuantity: number;
  availableSeats: number;
  reservedSeats: number;
  soldSeats: number;
  unitCost: number;
  totalCost: number;
  paidAmount: number;
  remainingLiability: number;
  currency: "EGP" | "SAR" | "USD";
  exchangeRateToEgp: number;
  paymentTerms?: string | undefined;
  paymentSchedule: IFlightPaymentScheduleItem[];
  attachments: string[];
  status: "DRAFT" | "ACTIVE" | "DEPLETED" | "COMPLETED" | "ARCHIVED" | "CANCELLED";
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const flightLotSchema = new mongoose.Schema<IFlightLot>(
  {
    contractReference: { type: String, required: true, unique: true, uppercase: true, trim: true },
    airline: { type: String, required: true, trim: true, index: true },
    airlineCode: { type: String, trim: true, uppercase: true },
    flightNumberOutbound: { type: String, trim: true, uppercase: true },
    flightNumberReturn: { type: String, trim: true, uppercase: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    brokerId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
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
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

flightLotSchema.index({ departureDate: 1, status: 1 });
flightLotSchema.index({ supplierId: 1, status: 1 });

export const FlightLotModel =
  (mongoose.models.FlightLot as mongoose.Model<IFlightLot>) ||
  mongoose.model<IFlightLot>("FlightLot", flightLotSchema);
export type HFlightLot = HydratedDocument<IFlightLot>;
