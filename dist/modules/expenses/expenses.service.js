"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expenseService = exports.ExpenseService = void 0;
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
const accounting_1 = require("../accounting");
const suppliers_1 = require("../suppliers");
class ExpenseService {
    async createExpenseOrSupplierPayment(payload, req) {
        const branchId = (0, middleware_1.assertBranchAccess)(req.branchContext, payload.branchId);
        const amount = utils_1.Money.round(payload.amount);
        if (amount <= 0)
            throw new exception_1.BadRequestException("Expense amount must be positive");
        return await (0, utils_1.withTransaction)(async (session) => {
            const cashbox = await module_1.CashboxModel.findOneAndUpdate({
                _id: payload.cashboxId,
                branchId,
                status: "OPEN",
                currentBalance: { $gte: amount },
            }, {
                $inc: {
                    totalOutflows: amount,
                    currentBalance: -amount,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!cashbox) {
                throw new exception_1.InsufficientBalanceError("Active cashbox not found or has insufficient balance for this payment");
            }
            const rate = utils_1.Money.roundRate(payload.exchangeRateToEgp || 1);
            const amountInEgp = utils_1.Money.convert(amount, rate);
            const branchDoc = await module_1.BranchModel.findById(branchId, "code", session ? { session } : undefined);
            const isSupplierPayment = payload.voucherType === "SUPPLIER_PAYMENT" || Boolean(payload.supplierId);
            const voucherNumber = await service_1.sequenceService.nextReference({
                documentType: isSupplierPayment ? "PAYMENT_VOUCHER" : "EXPENSE",
                branchCode: branchDoc?.code || "BR",
                session,
            });
            const debitAccountCode = isSupplierPayment
                ? "2102"
                : payload.tripId
                    ? "5103"
                    : "5201";
            const journalEntry = await accounting_1.accountingService.postJournalEntry({
                description: `${isSupplierPayment ? "Supplier Payment" : "Expense"} ${voucherNumber}: ${payload.description}`,
                sourceModule: isSupplierPayment ? "SUPPLIER_PAYMENTS" : "EXPENSES",
                sourceReferenceNumber: voucherNumber,
                branchId,
                tripId: payload.tripId,
                lines: [
                    { accountCode: debitAccountCode, debit: amountInEgp, memo: payload.description },
                    { accountCode: "1101", credit: amountInEgp, memo: `Cash outflow ${voucherNumber}` },
                ],
                actorId: req.user?._id,
                session,
            });
            const [expense] = await module_1.ExpenseModel.create([
                {
                    voucherNumber,
                    voucherType: isSupplierPayment ? "SUPPLIER_PAYMENT" : "OPERATIONAL_EXPENSE",
                    branchId,
                    cashboxId: cashbox._id,
                    tripId: payload.tripId || null,
                    supplierId: payload.supplierId || null,
                    flightLotId: payload.flightLotId || null,
                    hotelContractId: payload.hotelContractId || null,
                    category: payload.category || (isSupplierPayment ? "SUPPLIER_PAYMENT" : "GENERAL"),
                    amount,
                    currency: cashbox.currency,
                    exchangeRateToEgp: rate,
                    amountInEgp,
                    paymentMethod: payload.paymentMethod || "CASH",
                    description: payload.description,
                    journalEntryId: journalEntry._id,
                    status: "POSTED",
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            await module_1.FinancialTransactionModel.create([
                {
                    cashboxId: cashbox._id,
                    branchId,
                    tripId: payload.tripId || null,
                    direction: "OUTFLOW",
                    type: isSupplierPayment ? "SUPPLIER_PAYMENT" : "EXPENSE",
                    amount,
                    currency: cashbox.currency,
                    amountInEgp,
                    runningCashboxBalance: cashbox.currentBalance,
                    referenceType: "Expense",
                    referenceId: expense._id,
                    referenceNumber: voucherNumber,
                    journalEntryId: journalEntry._id,
                    description: payload.description,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            if (payload.supplierId) {
                await suppliers_1.supplierService.recordLedgerMovement({
                    supplierId: payload.supplierId,
                    branchId,
                    entryType: "PARTIAL_PAYMENT",
                    referenceType: "PAYMENT_VOUCHER",
                    referenceId: expense._id,
                    referenceNumber: voucherNumber,
                    description: payload.description,
                    debitAmount: amount,
                    exchangeRateToEgp: rate,
                    actorId: req.user?._id,
                    session,
                });
            }
            if (payload.flightLotId) {
                const lot = await module_1.FlightLotModel.findById(payload.flightLotId, null, session ? { session } : undefined);
                if (lot) {
                    lot.paidAmount = utils_1.Money.add(lot.paidAmount, amount);
                    lot.remainingLiability = Math.max(0, utils_1.Money.subtract(lot.totalCost, lot.paidAmount));
                    await lot.save(session ? { session } : undefined);
                }
            }
            if (payload.hotelContractId) {
                const hc = await module_1.HotelContractModel.findById(payload.hotelContractId, null, session ? { session } : undefined);
                if (hc) {
                    hc.paidAmount = utils_1.Money.add(hc.paidAmount, amount);
                    hc.remainingLiability = Math.max(0, utils_1.Money.subtract(hc.contractValue, hc.paidAmount));
                    await hc.save(session ? { session } : undefined);
                }
            }
            await service_1.auditService.record({
                req,
                action: isSupplierPayment ? "SUPPLIER_PAYMENT_CREATED" : "EXPENSE_CREATED",
                module: "expenses",
                entityType: "Expense",
                entityId: expense._id.toString(),
                branchId,
                newValues: expense.toObject(),
                session,
            });
            return expense;
        });
    }
}
exports.ExpenseService = ExpenseService;
exports.expenseService = new ExpenseService();
