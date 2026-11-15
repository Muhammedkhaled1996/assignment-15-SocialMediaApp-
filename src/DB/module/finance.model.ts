import mongoose, { HydratedDocument } from "mongoose";

// ==========================================
// 1. CASBOX & DAILY CLOSING / RECONCILIATION
// ==========================================
export interface ICashbox {
  _id?: mongoose.Types.ObjectId;
  code: string;
  nameAr: string;
  nameEn: string;
  branchId: mongoose.Types.ObjectId;
  isMainCashbox: boolean;
  currency: "EGP" | "SAR" | "USD";
  openingBalance: number;
  totalInflows: number;
  totalOutflows: number;
  currentBalance: number;
  status: "OPEN" | "CLOSED_DAILY" | "SUSPENDED";
  lastClosedAt?: Date | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
  updatedAt?: Date;
}

const cashboxSchema = new mongoose.Schema<ICashbox>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    isMainCashbox: { type: Boolean, default: false },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP", index: true },
    openingBalance: { type: Number, required: true, default: 0 },
    totalInflows: { type: Number, required: true, default: 0, min: 0 },
    totalOutflows: { type: Number, required: true, default: 0, min: 0 },
    currentBalance: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["OPEN", "CLOSED_DAILY", "SUSPENDED"], default: "OPEN", index: true },
    lastClosedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, strict: true },
);

cashboxSchema.index({ branchId: 1, currency: 1 });

export const CashboxModel =
  (mongoose.models.Cashbox as mongoose.Model<ICashbox>) || mongoose.model<ICashbox>("Cashbox", cashboxSchema);
export type HCashbox = HydratedDocument<ICashbox>;

export interface ICashboxClosure {
  _id?: mongoose.Types.ObjectId;
  cashboxId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  closingDate: Date;
  expectedSystemBalance: number;
  actualCountedBalance: number;
  discrepancyAmount: number; // actualCountedBalance - expectedSystemBalance
  notes?: string | undefined;
  closedBy: mongoose.Types.ObjectId;
  createdAt?: Date;
}

const cashboxClosureSchema = new mongoose.Schema<ICashboxClosure>(
  {
    cashboxId: { type: mongoose.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    closingDate: { type: Date, default: Date.now, index: true },
    expectedSystemBalance: { type: Number, required: true },
    actualCountedBalance: { type: Number, required: true },
    discrepancyAmount: { type: Number, required: true },
    notes: { type: String },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

export const CashboxClosureModel =
  (mongoose.models.CashboxClosure as mongoose.Model<ICashboxClosure>) ||
  mongoose.model<ICashboxClosure>("CashboxClosure", cashboxClosureSchema);

// ==========================================
// 2. CHART OF ACCOUNTS & DOUBLE-ENTRY JOURNAL
// ==========================================
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";

export interface IAccount {
  _id?: mongoose.Types.ObjectId;
  code: string; // e.g. "1101" Cash, "2101" Customer Advances, "4101" Umrah Trip Revenue
  nameAr: string;
  nameEn: string;
  type: AccountType;
  normalBalance: NormalBalance;
  parentAccountId?: mongoose.Types.ObjectId | null | undefined;
  isSystemAccount: boolean;
  isActive: boolean;
  totalDebits: number;
  totalCredits: number;
  currentBalance: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const accountSchema = new mongoose.Schema<IAccount>(
  {
    code: { type: String, required: true, unique: true, trim: true, index: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    type: { type: String, enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"], required: true, index: true },
    normalBalance: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
    parentAccountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", default: null },
    isSystemAccount: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    totalDebits: { type: Number, default: 0, min: 0 },
    totalCredits: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0 },
  },
  { timestamps: true, strict: true },
);

export const AccountModel =
  (mongoose.models.Account as mongoose.Model<IAccount>) || mongoose.model<IAccount>("Account", accountSchema);
export type HAccount = HydratedDocument<IAccount>;

export interface IJournalEntryLine {
  accountId: mongoose.Types.ObjectId;
  accountCode: string;
  accountName: string;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  tripId?: mongoose.Types.ObjectId | null | undefined;
  debit: number;
  credit: number;
  memo?: string | undefined;
}

export interface IJournalEntry {
  _id?: mongoose.Types.ObjectId;
  entryNumber: string;
  entryDate: Date;
  description: string;
  sourceModule: "CASHBOXES" | "RECEIPTS" | "EXPENSES" | "SUPPLIER_PAYMENTS" | "TRANSFERS" | "PROCUREMENT" | "REVENUE_RECOGNITION";
  sourceReferenceId?: mongoose.Types.ObjectId | undefined;
  sourceReferenceNumber?: string | undefined;
  branchId?: mongoose.Types.ObjectId | null | undefined;
  tripId?: mongoose.Types.ObjectId | null | undefined;
  lines: IJournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  status: "POSTED" | "REVERSED";
  postedBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const journalEntryLineSchema = new mongoose.Schema<IJournalEntryLine>(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null },
    debit: { type: Number, required: true, default: 0, min: 0 },
    credit: { type: Number, required: true, default: 0, min: 0 },
    memo: { type: String },
  },
  { _id: false },
);

const journalEntrySchema = new mongoose.Schema<IJournalEntry>(
  {
    entryNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    entryDate: { type: Date, required: true, default: Date.now, index: true },
    description: { type: String, required: true, trim: true },
    sourceModule: {
      type: String,
      enum: [
        "CASHBOXES",
        "RECEIPTS",
        "EXPENSES",
        "SUPPLIER_PAYMENTS",
        "TRANSFERS",
        "PROCUREMENT",
        "REVENUE_RECOGNITION",
      ],
      required: true,
      index: true,
    },
    sourceReferenceId: { type: mongoose.Schema.Types.ObjectId, index: true },
    sourceReferenceNumber: { type: String },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    lines: { type: [journalEntryLineSchema], required: true },
    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["POSTED", "REVERSED"], default: "POSTED", index: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

journalEntrySchema.index({ "lines.accountId": 1, entryDate: 1 });
journalEntrySchema.index({ branchId: 1, entryDate: -1 });
journalEntrySchema.index({ tripId: 1, entryDate: -1 });

export const JournalEntryModel =
  (mongoose.models.JournalEntry as mongoose.Model<IJournalEntry>) ||
  mongoose.model<IJournalEntry>("JournalEntry", journalEntrySchema);
export type HJournalEntry = HydratedDocument<IJournalEntry>;

// ==========================================
// 3. RECEIPTS, EXPENSES, TRANSFERS & TRANSACTIONS
// ==========================================
export interface IReceipt {
  _id?: mongoose.Types.ObjectId;
  idempotencyKey?: string | undefined;
  receiptNumber: string;
  receiptType: "CUSTOMER_RECEIPT" | "WHOLESALE_RECEIPT" | "REFUND_VOUCHER";
  bookingId?: mongoose.Types.ObjectId | null | undefined;
  wholesaleContractId?: mongoose.Types.ObjectId | null | undefined;
  passengerId?: mongoose.Types.ObjectId | null | undefined;
  tripId?: mongoose.Types.ObjectId | null | undefined;
  branchId: mongoose.Types.ObjectId;
  cashboxId: mongoose.Types.ObjectId;
  amount: number;
  currency: "EGP" | "SAR" | "USD";
  exchangeRateToEgp: number;
  amountInEgp: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "POS_CARD" | "CHEQUE";
  referenceCode?: string | undefined;
  status: "POSTED" | "REVERSED";
  journalEntryId?: mongoose.Types.ObjectId | undefined;
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const receiptSchema = new mongoose.Schema<IReceipt>(
  {
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    receiptNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    receiptType: {
      type: String,
      enum: ["CUSTOMER_RECEIPT", "WHOLESALE_RECEIPT", "REFUND_VOUCHER"],
      default: "CUSTOMER_RECEIPT",
      index: true,
    },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    wholesaleContractId: { type: mongoose.Schema.Types.ObjectId, ref: "WholesaleContract", default: null, index: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "Passenger", default: null },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    cashboxId: { type: mongoose.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1, min: 0.0001 },
    amountInEgp: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["CASH", "BANK_TRANSFER", "POS_CARD", "CHEQUE"], default: "CASH" },
    referenceCode: { type: String, trim: true },
    status: { type: String, enum: ["POSTED", "REVERSED"], default: "POSTED", index: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

receiptSchema.index({ branchId: 1, createdAt: -1 });

export const ReceiptModel =
  (mongoose.models.Receipt as mongoose.Model<IReceipt>) || mongoose.model<IReceipt>("Receipt", receiptSchema);
export type HReceipt = HydratedDocument<IReceipt>;

export interface IExpense {
  _id?: mongoose.Types.ObjectId;
  voucherNumber: string;
  voucherType: "OPERATIONAL_EXPENSE" | "SUPPLIER_PAYMENT";
  branchId: mongoose.Types.ObjectId;
  cashboxId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId | null | undefined;
  supplierId?: mongoose.Types.ObjectId | null | undefined;
  flightLotId?: mongoose.Types.ObjectId | null | undefined;
  hotelContractId?: mongoose.Types.ObjectId | null | undefined;
  category: string; // e.g. "SUPPLIER_PAYMENT", "RENT", "SALARIES", "MARKETING", "VISA_BARCODE", "SUPERVISOR"
  amount: number;
  currency: "EGP" | "SAR" | "USD";
  exchangeRateToEgp: number;
  amountInEgp: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CHEQUE";
  description: string;
  journalEntryId?: mongoose.Types.ObjectId | undefined;
  status: "POSTED" | "REVERSED";
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const expenseSchema = new mongoose.Schema<IExpense>(
  {
    voucherNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    voucherType: {
      type: String,
      enum: ["OPERATIONAL_EXPENSE", "SUPPLIER_PAYMENT"],
      required: true,
      index: true,
    },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    cashboxId: { type: mongoose.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    flightLotId: { type: mongoose.Schema.Types.ObjectId, ref: "FlightLot", default: null },
    hotelContractId: { type: mongoose.Schema.Types.ObjectId, ref: "HotelContract", default: null },
    category: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1, min: 0.0001 },
    amountInEgp: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["CASH", "BANK_TRANSFER", "CHEQUE"], default: "CASH" },
    description: { type: String, required: true, trim: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    status: { type: String, enum: ["POSTED", "REVERSED"], default: "POSTED", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

expenseSchema.index({ branchId: 1, createdAt: -1 });

export const ExpenseModel =
  (mongoose.models.Expense as mongoose.Model<IExpense>) || mongoose.model<IExpense>("Expense", expenseSchema);
export type HExpense = HydratedDocument<IExpense>;

export interface ICashTransfer {
  _id?: mongoose.Types.ObjectId;
  transferNumber: string;
  fromCashboxId: mongoose.Types.ObjectId;
  toCashboxId: mongoose.Types.ObjectId;
  fromBranchId: mongoose.Types.ObjectId;
  toBranchId: mongoose.Types.ObjectId;
  amount: number;
  currency: "EGP" | "SAR" | "USD";
  exchangeRateToEgp: number;
  amountInEgp: number;
  status: "COMPLETED" | "REVERSED";
  journalEntryId?: mongoose.Types.ObjectId | undefined;
  notes?: string | undefined;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const cashTransferSchema = new mongoose.Schema<ICashTransfer>(
  {
    transferNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fromCashboxId: { type: mongoose.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    toCashboxId: { type: mongoose.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1 },
    amountInEgp: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ["COMPLETED", "REVERSED"], default: "COMPLETED" },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    notes: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

export const CashTransferModel =
  (mongoose.models.CashTransfer as mongoose.Model<ICashTransfer>) ||
  mongoose.model<ICashTransfer>("CashTransfer", cashTransferSchema);

export interface IFinancialTransaction {
  _id?: mongoose.Types.ObjectId;
  cashboxId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  tripId?: mongoose.Types.ObjectId | null | undefined;
  direction: "INFLOW" | "OUTFLOW";
  type: "RECEIPT" | "REFUND" | "EXPENSE" | "SUPPLIER_PAYMENT" | "TRANSFER_IN" | "TRANSFER_OUT" | "OPENING_BALANCE";
  amount: number;
  currency: "EGP" | "SAR" | "USD";
  amountInEgp: number;
  runningCashboxBalance: number;
  referenceType: string;
  referenceId: mongoose.Types.ObjectId;
  referenceNumber: string;
  journalEntryId?: mongoose.Types.ObjectId | undefined;
  description: string;
  createdBy?: mongoose.Types.ObjectId | undefined;
  createdAt?: Date;
}

const financialTransactionSchema = new mongoose.Schema<IFinancialTransaction>(
  {
    cashboxId: { type: mongoose.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    direction: { type: String, enum: ["INFLOW", "OUTFLOW"], required: true },
    type: {
      type: String,
      enum: ["RECEIPT", "REFUND", "EXPENSE", "SUPPLIER_PAYMENT", "TRANSFER_IN", "TRANSFER_OUT", "OPENING_BALANCE"],
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], required: true },
    amountInEgp: { type: Number, required: true, min: 0 },
    runningCashboxBalance: { type: Number, required: true },
    referenceType: { type: String, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    referenceNumber: { type: String, required: true },
    journalEntryId: { type: mongoose.Schema.Types.ObjectId, ref: "JournalEntry" },
    description: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: true },
);

financialTransactionSchema.index({ cashboxId: 1, createdAt: -1 });
financialTransactionSchema.index({ branchId: 1, createdAt: -1 });

export const FinancialTransactionModel =
  (mongoose.models.FinancialTransaction as mongoose.Model<IFinancialTransaction>) ||
  mongoose.model<IFinancialTransaction>("FinancialTransaction", financialTransactionSchema);
