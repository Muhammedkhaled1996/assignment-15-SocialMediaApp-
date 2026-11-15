"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptService = exports.ReceiptService = void 0;
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
const accounting_1 = require("../accounting");
class ReceiptService {
    async createReceipt(payload, req) {
        const branchId = (0, middleware_1.assertBranchAccess)(req.branchContext, payload.branchId);
        const idempotencyKey = payload.idempotencyKey || req.headers["idempotency-key"];
        if (idempotencyKey) {
            const existing = await module_1.ReceiptModel.findOne({ idempotencyKey });
            if (existing)
                return existing;
        }
        const amount = utils_1.Money.round(payload.amount);
        if (amount <= 0)
            throw new exception_1.BadRequestException("Receipt amount must be greater than zero");
        return await (0, utils_1.withTransaction)(async (session) => {
            const cashbox = await module_1.CashboxModel.findOne({ _id: payload.cashboxId, branchId, status: "OPEN" }, null, session ? { session } : undefined);
            if (!cashbox) {
                throw new exception_1.NotFoundException("Active open cashbox not found for this branch");
            }
            const rate = utils_1.Money.roundRate(payload.exchangeRateToEgp || 1);
            const amountInEgp = utils_1.Money.convert(amount, rate);
            let booking = null;
            let wholesaleContract = null;
            let tripId = payload.tripId || null;
            let passengerId = payload.passengerId || null;
            if (payload.bookingId) {
                booking = await module_1.BookingModel.findById(payload.bookingId, null, session ? { session } : undefined);
                if (!booking)
                    throw new exception_1.NotFoundException("Booking not found");
                if (!req.branchContext?.isCentralAdmin && booking.branchId.toString() !== branchId.toString()) {
                    throw new exception_1.ForbiddenException("Cross-branch receipt creation denied");
                }
                if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
                    throw new exception_1.BadRequestException(`Cannot collect payment on ${booking.status} booking`);
                }
                if (amountInEgp > utils_1.Money.add(booking.remainingBalance, 0.01)) {
                    throw new exception_1.BadRequestException(`Payment amount (${amountInEgp} EGP) exceeds booking remaining balance (${booking.remainingBalance} EGP)`);
                }
                tripId = booking.tripId;
                passengerId = booking.passengerId;
            }
            else if (payload.wholesaleContractId) {
                wholesaleContract = await module_1.WholesaleContractModel.findById(payload.wholesaleContractId, null, session ? { session } : undefined);
                if (!wholesaleContract)
                    throw new exception_1.NotFoundException("Wholesale contract not found");
                tripId = wholesaleContract.tripId;
            }
            const branchDoc = await module_1.BranchModel.findById(branchId, "code", session ? { session } : undefined);
            const receiptNumber = await service_1.sequenceService.nextReference({
                documentType: "RECEIPT",
                branchCode: branchDoc?.code || "BR",
                session,
            });
            cashbox.totalInflows = utils_1.Money.add(cashbox.totalInflows, amount);
            cashbox.currentBalance = utils_1.Money.add(cashbox.currentBalance, amount);
            await cashbox.save(session ? { session } : undefined);
            const creditAccountCode = wholesaleContract ? "4102" : "2101";
            const journalEntry = await accounting_1.accountingService.postJournalEntry({
                description: `Customer Receipt ${receiptNumber}${booking ? ` for Booking ${booking.bookingNumber}` : ""}`,
                sourceModule: "RECEIPTS",
                sourceReferenceNumber: receiptNumber,
                branchId,
                tripId,
                lines: [
                    { accountCode: "1101", debit: amountInEgp, memo: `Cash inflow ${receiptNumber}` },
                    { accountCode: creditAccountCode, credit: amountInEgp, memo: `Receipt ${receiptNumber}` },
                ],
                actorId: req.user?._id,
                session,
            });
            const [receipt] = await module_1.ReceiptModel.create([
                {
                    ...(idempotencyKey ? { idempotencyKey } : {}),
                    receiptNumber,
                    receiptType: wholesaleContract ? "WHOLESALE_RECEIPT" : "CUSTOMER_RECEIPT",
                    bookingId: booking?._id || null,
                    wholesaleContractId: wholesaleContract?._id || null,
                    passengerId,
                    tripId,
                    branchId,
                    cashboxId: cashbox._id,
                    amount,
                    currency: cashbox.currency,
                    exchangeRateToEgp: rate,
                    amountInEgp,
                    paymentMethod: payload.paymentMethod || "CASH",
                    referenceCode: payload.referenceCode,
                    status: "POSTED",
                    journalEntryId: journalEntry._id,
                    notes: payload.notes,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            await module_1.FinancialTransactionModel.create([
                {
                    cashboxId: cashbox._id,
                    branchId,
                    tripId,
                    direction: "INFLOW",
                    type: "RECEIPT",
                    amount,
                    currency: cashbox.currency,
                    amountInEgp,
                    runningCashboxBalance: cashbox.currentBalance,
                    referenceType: "Receipt",
                    referenceId: receipt._id,
                    referenceNumber: receiptNumber,
                    journalEntryId: journalEntry._id,
                    description: `Receipt ${receiptNumber}`,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            if (booking) {
                booking.amountPaid = utils_1.Money.add(booking.amountPaid, amountInEgp);
                booking.remainingBalance = Math.max(0, utils_1.Money.subtract(booking.netSellingPrice, booking.amountPaid));
                booking.paymentRecordIds.push(receipt._id);
                if (booking.status === "DRAFT" || booking.status === "ON_HOLD") {
                    booking.status = "PENDING_PAYMENT";
                }
                await booking.save(session ? { session } : undefined);
            }
            if (wholesaleContract) {
                wholesaleContract.paidAmountEgp = utils_1.Money.add(wholesaleContract.paidAmountEgp, amountInEgp);
                wholesaleContract.remainingBalanceEgp = Math.max(0, utils_1.Money.subtract(wholesaleContract.totalContractPriceEgp, wholesaleContract.paidAmountEgp));
                await wholesaleContract.save(session ? { session } : undefined);
                const partner = await module_1.WholesalePartnerModel.findById(wholesaleContract.partnerId, null, session ? { session } : undefined);
                if (partner) {
                    partner.totalPaidAmount = utils_1.Money.add(partner.totalPaidAmount, amountInEgp);
                    partner.currentBalance = Math.max(0, utils_1.Money.subtract(partner.totalContractedAmount, partner.totalPaidAmount));
                    await partner.save(session ? { session } : undefined);
                }
            }
            await service_1.auditService.record({
                req,
                action: "RECEIPT_CREATED",
                module: "receipts",
                entityType: "Receipt",
                entityId: receipt._id.toString(),
                branchId,
                newValues: receipt.toObject(),
                session,
            });
            return receipt;
        });
    }
    async createRefundVoucher(payload, req) {
        const branchId = (0, middleware_1.assertBranchAccess)(req.branchContext, payload.branchId);
        const amount = utils_1.Money.round(payload.amount);
        if (amount <= 0)
            throw new exception_1.BadRequestException("Refund amount must be positive");
        return await (0, utils_1.withTransaction)(async (session) => {
            const booking = await module_1.BookingModel.findById(payload.bookingId, null, session ? { session } : undefined);
            if (!booking)
                throw new exception_1.NotFoundException("Booking not found");
            if (!req.branchContext?.isCentralAdmin && booking.branchId.toString() !== branchId.toString()) {
                throw new exception_1.ForbiddenException("Cross-branch refund denied");
            }
            const refundable = utils_1.Money.subtract(booking.amountPaid, booking.refundedAmount);
            if (amount > refundable) {
                throw new exception_1.BadRequestException(`Refund amount (${amount}) exceeds net refundable amount (${refundable})`);
            }
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
                throw new exception_1.InsufficientBalanceError("Cashbox does not have sufficient balance to issue this refund");
            }
            const branchDoc = await module_1.BranchModel.findById(branchId, "code", session ? { session } : undefined);
            const receiptNumber = await service_1.sequenceService.nextReference({
                documentType: "RECEIPT",
                prefix: "RFD",
                branchCode: branchDoc?.code || "BR",
                session,
            });
            const journalEntry = await accounting_1.accountingService.postJournalEntry({
                description: `Customer Refund ${receiptNumber} for Booking ${booking.bookingNumber}`,
                sourceModule: "RECEIPTS",
                sourceReferenceNumber: receiptNumber,
                branchId,
                tripId: booking.tripId,
                lines: [
                    { accountCode: "2101", debit: amount, memo: `Refund on booking ${booking.bookingNumber}` },
                    { accountCode: "1101", credit: amount, memo: `Cash outflow ${receiptNumber}` },
                ],
                actorId: req.user?._id,
                session,
            });
            const [refundReceipt] = await module_1.ReceiptModel.create([
                {
                    receiptNumber,
                    receiptType: "REFUND_VOUCHER",
                    bookingId: booking._id,
                    passengerId: booking.passengerId,
                    tripId: booking.tripId,
                    branchId,
                    cashboxId: cashbox._id,
                    amount,
                    currency: cashbox.currency,
                    exchangeRateToEgp: 1,
                    amountInEgp: amount,
                    paymentMethod: payload.paymentMethod || "CASH",
                    status: "POSTED",
                    journalEntryId: journalEntry._id,
                    notes: payload.notes || "Customer booking refund",
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            await module_1.FinancialTransactionModel.create([
                {
                    cashboxId: cashbox._id,
                    branchId,
                    tripId: booking.tripId,
                    direction: "OUTFLOW",
                    type: "REFUND",
                    amount,
                    currency: cashbox.currency,
                    amountInEgp: amount,
                    runningCashboxBalance: cashbox.currentBalance,
                    referenceType: "Receipt",
                    referenceId: refundReceipt._id,
                    referenceNumber: receiptNumber,
                    journalEntryId: journalEntry._id,
                    description: `Refund ${receiptNumber} for Booking ${booking.bookingNumber}`,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            booking.refundedAmount = utils_1.Money.add(booking.refundedAmount, amount);
            booking.remainingBalance = utils_1.Money.subtract(booking.netSellingPrice, utils_1.Money.subtract(booking.amountPaid, booking.refundedAmount));
            if (utils_1.Money.equals(booking.refundedAmount, booking.amountPaid)) {
                const prevStatus = booking.status;
                booking.status = "REFUNDED";
                booking.history.push({
                    fromStatus: prevStatus,
                    toStatus: "REFUNDED",
                    changedBy: req.user?._id,
                    reason: payload.notes || "Full refund issued",
                    timestamp: new Date(),
                });
            }
            await booking.save(session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "REFUND_VOUCHER_CREATED",
                module: "receipts",
                entityType: "Receipt",
                entityId: refundReceipt._id.toString(),
                branchId,
                newValues: refundReceipt.toObject(),
                session,
            });
            service_1.telegramService
                .notifyAdmins([
                `💸 <b>إشعار استرداد نقدي لعميل (Refund)</b>`,
                `• رقم سند الاسترداد: <code>${receiptNumber}</code>`,
                `• رقم الحجز: <code>${booking.bookingNumber}</code>`,
                `• المبلغ المسترد: <b>${amount} ${cashbox.currency}</b>`,
                `• السبب / الملاحظات: ${payload.notes || "استرداد حجز عميل"}`,
            ].join("\n"))
                .catch(() => { });
            return refundReceipt;
        });
    }
}
exports.ReceiptService = ReceiptService;
exports.receiptService = new ReceiptService();
