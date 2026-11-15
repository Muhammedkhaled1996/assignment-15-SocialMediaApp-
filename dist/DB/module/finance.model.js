"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialTransactionModel = exports.CashTransferModel = exports.ExpenseModel = exports.ReceiptModel = exports.JournalEntryModel = exports.AccountModel = exports.CashboxClosureModel = exports.CashboxModel = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const cashboxSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    isMainCashbox: { type: Boolean, default: false },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP", index: true },
    openingBalance: { type: Number, required: true, default: 0 },
    totalInflows: { type: Number, required: true, default: 0, min: 0 },
    totalOutflows: { type: Number, required: true, default: 0, min: 0 },
    currentBalance: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["OPEN", "CLOSED_DAILY", "SUSPENDED"], default: "OPEN", index: true },
    lastClosedAt: { type: Date },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true, strict: true });
cashboxSchema.index({ branchId: 1, currency: 1 });
exports.CashboxModel = mongoose_1.default.models.Cashbox || mongoose_1.default.model("Cashbox", cashboxSchema);
const cashboxClosureSchema = new mongoose_1.default.Schema({
    cashboxId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    closingDate: { type: Date, default: Date.now, index: true },
    expectedSystemBalance: { type: Number, required: true },
    actualCountedBalance: { type: Number, required: true },
    discrepancyAmount: { type: Number, required: true },
    notes: { type: String },
    closedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
exports.CashboxClosureModel = mongoose_1.default.models.CashboxClosure ||
    mongoose_1.default.model("CashboxClosure", cashboxClosureSchema);
const accountSchema = new mongoose_1.default.Schema({
    code: { type: String, required: true, unique: true, trim: true, index: true },
    nameAr: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    type: { type: String, enum: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"], required: true, index: true },
    normalBalance: { type: String, enum: ["DEBIT", "CREDIT"], required: true },
    parentAccountId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Account", default: null },
    isSystemAccount: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    totalDebits: { type: Number, default: 0, min: 0 },
    totalCredits: { type: Number, default: 0, min: 0 },
    currentBalance: { type: Number, default: 0 },
}, { timestamps: true, strict: true });
exports.AccountModel = mongoose_1.default.models.Account || mongoose_1.default.model("Account", accountSchema);
const journalEntryLineSchema = new mongoose_1.default.Schema({
    accountId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Account", required: true },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", default: null },
    debit: { type: Number, required: true, default: 0, min: 0 },
    credit: { type: Number, required: true, default: 0, min: 0 },
    memo: { type: String },
}, { _id: false });
const journalEntrySchema = new mongoose_1.default.Schema({
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
    sourceReferenceId: { type: mongoose_1.default.Schema.Types.ObjectId, index: true },
    sourceReferenceNumber: { type: String },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    lines: { type: [journalEntryLineSchema], required: true },
    totalDebit: { type: Number, required: true, min: 0 },
    totalCredit: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["POSTED", "REVERSED"], default: "POSTED", index: true },
    postedBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
journalEntrySchema.index({ "lines.accountId": 1, entryDate: 1 });
journalEntrySchema.index({ branchId: 1, entryDate: -1 });
journalEntrySchema.index({ tripId: 1, entryDate: -1 });
exports.JournalEntryModel = mongoose_1.default.models.JournalEntry ||
    mongoose_1.default.model("JournalEntry", journalEntrySchema);
const receiptSchema = new mongoose_1.default.Schema({
    idempotencyKey: { type: String, unique: true, sparse: true, index: true },
    receiptNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    receiptType: {
        type: String,
        enum: ["CUSTOMER_RECEIPT", "WHOLESALE_RECEIPT", "REFUND_VOUCHER"],
        default: "CUSTOMER_RECEIPT",
        index: true,
    },
    bookingId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    wholesaleContractId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "WholesaleContract", default: null, index: true },
    passengerId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Passenger", default: null },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    cashboxId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1, min: 0.0001 },
    amountInEgp: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["CASH", "BANK_TRANSFER", "POS_CARD", "CHEQUE"], default: "CASH" },
    referenceCode: { type: String, trim: true },
    status: { type: String, enum: ["POSTED", "REVERSED"], default: "POSTED", index: true },
    journalEntryId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "JournalEntry" },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
receiptSchema.index({ branchId: 1, createdAt: -1 });
exports.ReceiptModel = mongoose_1.default.models.Receipt || mongoose_1.default.model("Receipt", receiptSchema);
const expenseSchema = new mongoose_1.default.Schema({
    voucherNumber: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    voucherType: {
        type: String,
        enum: ["OPERATIONAL_EXPENSE", "SUPPLIER_PAYMENT"],
        required: true,
        index: true,
    },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    cashboxId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
    supplierId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Supplier", default: null, index: true },
    flightLotId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "FlightLot", default: null },
    hotelContractId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "HotelContract", default: null },
    category: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1, min: 0.0001 },
    amountInEgp: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["CASH", "BANK_TRANSFER", "CHEQUE"], default: "CASH" },
    description: { type: String, required: true, trim: true },
    journalEntryId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "JournalEntry" },
    status: { type: String, enum: ["POSTED", "REVERSED"], default: "POSTED", index: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
expenseSchema.index({ branchId: 1, createdAt: -1 });
exports.ExpenseModel = mongoose_1.default.models.Expense || mongoose_1.default.model("Expense", expenseSchema);
const cashTransferSchema = new mongoose_1.default.Schema({
    transferNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    fromCashboxId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    toCashboxId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    fromBranchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    toBranchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, enum: ["EGP", "SAR", "USD"], default: "EGP" },
    exchangeRateToEgp: { type: Number, default: 1 },
    amountInEgp: { type: Number, required: true, min: 0.01 },
    status: { type: String, enum: ["COMPLETED", "REVERSED"], default: "COMPLETED" },
    journalEntryId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "JournalEntry" },
    notes: { type: String },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
exports.CashTransferModel = mongoose_1.default.models.CashTransfer ||
    mongoose_1.default.model("CashTransfer", cashTransferSchema);
const financialTransactionSchema = new mongoose_1.default.Schema({
    cashboxId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Cashbox", required: true, index: true },
    branchId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Branch", required: true, index: true },
    tripId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "Trip", default: null, index: true },
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
    referenceId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true, index: true },
    referenceNumber: { type: String, required: true },
    journalEntryId: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "JournalEntry" },
    description: { type: String, required: true },
    createdBy: { type: mongoose_1.default.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: { createdAt: true, updatedAt: false }, strict: true });
financialTransactionSchema.index({ cashboxId: 1, createdAt: -1 });
financialTransactionSchema.index({ branchId: 1, createdAt: -1 });
exports.FinancialTransactionModel = mongoose_1.default.models.FinancialTransaction ||
    mongoose_1.default.model("FinancialTransaction", financialTransactionSchema);
