"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferService = exports.TransferService = void 0;
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
const accounting_1 = require("../accounting");
class TransferService {
    async createTransfer(payload, req) {
        if (payload.fromCashboxId === payload.toCashboxId) {
            throw new exception_1.BadRequestException("Source and destination cashboxes must be different");
        }
        const amount = utils_1.Money.round(payload.amount);
        if (amount <= 0)
            throw new exception_1.BadRequestException("Transfer amount must be positive");
        return await (0, utils_1.withTransaction)(async (session) => {
            const fromCashbox = await module_1.CashboxModel.findById(payload.fromCashboxId, null, session ? { session } : undefined);
            const toCashbox = await module_1.CashboxModel.findById(payload.toCashboxId, null, session ? { session } : undefined);
            if (!fromCashbox || !toCashbox) {
                throw new exception_1.NotFoundException("Source or destination cashbox not found");
            }
            (0, middleware_1.assertBranchAccess)(req.branchContext, fromCashbox.branchId);
            if (fromCashbox.currency !== toCashbox.currency) {
                throw new exception_1.BadRequestException("Source and destination cashboxes must share the same currency");
            }
            const updatedSource = await module_1.CashboxModel.findOneAndUpdate({
                _id: fromCashbox._id,
                status: "OPEN",
                currentBalance: { $gte: amount },
            }, {
                $inc: {
                    totalOutflows: amount,
                    currentBalance: -amount,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!updatedSource) {
                throw new exception_1.InsufficientBalanceError("Source cashbox does not have sufficient balance for this transfer");
            }
            const updatedDest = await module_1.CashboxModel.findOneAndUpdate({
                _id: toCashbox._id,
                status: "OPEN",
            }, {
                $inc: {
                    totalInflows: amount,
                    currentBalance: amount,
                },
            }, { returnDocument: "after", ...(session ? { session } : {}) });
            if (!updatedDest) {
                throw new exception_1.BadRequestException("Destination cashbox is not open");
            }
            const rate = utils_1.Money.roundRate(payload.exchangeRateToEgp || 1);
            const amountInEgp = utils_1.Money.convert(amount, rate);
            const transferNumber = await service_1.sequenceService.nextReference({
                documentType: "TRANSFER",
                prefix: "TRF",
                session,
            });
            const journalEntry = await accounting_1.accountingService.postJournalEntry({
                description: `Inter-cashbox transfer ${transferNumber} (${fromCashbox.code} -> ${toCashbox.code})`,
                sourceModule: "TRANSFERS",
                sourceReferenceNumber: transferNumber,
                branchId: fromCashbox.branchId,
                lines: [
                    {
                        accountCode: "1101",
                        debit: amountInEgp,
                        branchId: toCashbox.branchId,
                        memo: `Transfer in to ${toCashbox.code}`,
                    },
                    {
                        accountCode: "1101",
                        credit: amountInEgp,
                        branchId: fromCashbox.branchId,
                        memo: `Transfer out from ${fromCashbox.code}`,
                    },
                ],
                actorId: req.user?._id,
                session,
            });
            const [transfer] = await module_1.CashTransferModel.create([
                {
                    transferNumber,
                    fromCashboxId: fromCashbox._id,
                    toCashboxId: toCashbox._id,
                    fromBranchId: fromCashbox.branchId,
                    toBranchId: toCashbox.branchId,
                    amount,
                    currency: fromCashbox.currency,
                    exchangeRateToEgp: rate,
                    amountInEgp,
                    status: "COMPLETED",
                    journalEntryId: journalEntry._id,
                    notes: payload.notes,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            await module_1.FinancialTransactionModel.create([
                {
                    cashboxId: fromCashbox._id,
                    branchId: fromCashbox.branchId,
                    direction: "OUTFLOW",
                    type: "TRANSFER_OUT",
                    amount,
                    currency: fromCashbox.currency,
                    amountInEgp,
                    runningCashboxBalance: updatedSource.currentBalance,
                    referenceType: "CashTransfer",
                    referenceId: transfer._id,
                    referenceNumber: transferNumber,
                    journalEntryId: journalEntry._id,
                    description: `Transfer out to ${toCashbox.code}`,
                    createdBy: req.user?._id,
                },
                {
                    cashboxId: toCashbox._id,
                    branchId: toCashbox.branchId,
                    direction: "INFLOW",
                    type: "TRANSFER_IN",
                    amount,
                    currency: toCashbox.currency,
                    amountInEgp,
                    runningCashboxBalance: updatedDest.currentBalance,
                    referenceType: "CashTransfer",
                    referenceId: transfer._id,
                    referenceNumber: transferNumber,
                    journalEntryId: journalEntry._id,
                    description: `Transfer in from ${fromCashbox.code}`,
                    createdBy: req.user?._id,
                },
            ], session ? { session, ordered: true } : undefined);
            await service_1.auditService.record({
                req,
                action: "CASH_TRANSFER_COMPLETED",
                module: "transfers",
                entityType: "CashTransfer",
                entityId: transfer._id.toString(),
                branchId: fromCashbox.branchId,
                newValues: transfer.toObject(),
                session,
            });
            return transfer;
        });
    }
}
exports.TransferService = TransferService;
exports.transferService = new TransferService();
