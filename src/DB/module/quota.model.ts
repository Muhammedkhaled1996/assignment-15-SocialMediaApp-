import mongoose, { HydratedDocument } from "mongoose";

export interface IBranchQuota {
  _id?: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  allocatedSeats: number;
  availableSeats: number;
  reservedSeats: number;
  consumedSeats: number;
  status: "ACTIVE" | "RELEASED" | "CLOSED";
  updatedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const branchQuotaSchema = new mongoose.Schema<IBranchQuota>(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    allocatedSeats: { type: Number, required: true, min: 0 },
    availableSeats: { type: Number, required: true, min: 0 },
    reservedSeats: { type: Number, required: true, default: 0, min: 0 },
    consumedSeats: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "RELEASED", "CLOSED"], default: "ACTIVE" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

branchQuotaSchema.index({ tripId: 1, branchId: 1 }, { unique: true });

export const BranchQuotaModel =
  (mongoose.models.BranchQuota as mongoose.Model<IBranchQuota>) ||
  mongoose.model<IBranchQuota>("BranchQuota", branchQuotaSchema);
export type HBranchQuota = HydratedDocument<IBranchQuota>;

export interface IInventoryReservation {
  _id?: mongoose.Types.ObjectId;
  idempotencyKey?: string | undefined;
  tripId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId | null | undefined;
  bookingReference?: string | undefined;
  quantity: number;
  quotaSource: "SHARED" | "BRANCH_ALLOCATED" | "WHOLESALE";
  expiresAt: Date;
  status: "ACTIVE_HOLD" | "CONSUMED" | "RELEASED" | "EXPIRED";
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const inventoryReservationSchema = new mongoose.Schema<IInventoryReservation>(
  {
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    bookingReference: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    quotaSource: { type: String, enum: ["SHARED", "BRANCH_ALLOCATED", "WHOLESALE"], required: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["ACTIVE_HOLD", "CONSUMED", "RELEASED", "EXPIRED"],
      default: "ACTIVE_HOLD",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

inventoryReservationSchema.index({ status: 1, expiresAt: 1 });
inventoryReservationSchema.index({ tripId: 1, branchId: 1, status: 1 });

export const InventoryReservationModel =
  (mongoose.models.InventoryReservation as mongoose.Model<IInventoryReservation>) ||
  mongoose.model<IInventoryReservation>("InventoryReservation", inventoryReservationSchema);
export type HInventoryReservation = HydratedDocument<IInventoryReservation>;

export type InventoryMovementAction =
  | "ALLOCATE_BRANCH"
  | "TRANSFER_BRANCH"
  | "RELEASE_BRANCH"
  | "RESERVE_SEATS"
  | "CONSUME_SEATS"
  | "RELEASE_RESERVATION"
  | "EXPIRE_RESERVATION"
  | "WHOLESALE_ALLOCATE"
  | "WHOLESALE_RELEASE"
  | "RECONCILE";

export interface IInventoryMovement {
  _id?: mongoose.Types.ObjectId;
  tripId: mongoose.Types.ObjectId;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  targetBranchId?: mongoose.Types.ObjectId | null | undefined;
  action: InventoryMovementAction;
  quantity: number;
  referenceId?: string | undefined;
  notes?: string | undefined;
  actorId?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const inventoryMovementSchema = new mongoose.Schema<IInventoryMovement>(
  {
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    targetBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    action: {
      type: String,
      enum: [
        "ALLOCATE_BRANCH",
        "TRANSFER_BRANCH",
        "RELEASE_BRANCH",
        "RESERVE_SEATS",
        "CONSUME_SEATS",
        "RELEASE_RESERVATION",
        "EXPIRE_RESERVATION",
        "WHOLESALE_ALLOCATE",
        "WHOLESALE_RELEASE",
        "RECONCILE",
      ],
      required: true,
      index: true,
    },
    quantity: { type: Number, required: true },
    referenceId: { type: String },
    notes: { type: String },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

inventoryMovementSchema.index({ tripId: 1, createdAt: -1 });

export const InventoryMovementModel =
  (mongoose.models.InventoryMovement as mongoose.Model<IInventoryMovement>) ||
  mongoose.model<IInventoryMovement>("InventoryMovement", inventoryMovementSchema);
export type HInventoryMovement = HydratedDocument<IInventoryMovement>;
