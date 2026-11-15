"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashboxService = exports.CashboxService = void 0;
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
const accounting_1 = require("../accounting");
class CashboxService {
    async createCashbox(payload, req) {
        const branchId = (0, middleware_1.assertBranchAccess)(req.branchContext, payload.branchId);
        const code = payload.code.toUpperCase().trim();
        const exists = await module_1.CashboxModel.findOne({ code });
        if (exists)
            throw new exception_1.ConflictException(`Cashbox ${code} already exists`);
        const openingBalance = utils_1.Money.round(payload.openingBalance || 0);
        return await (0, utils_1.withTransaction)(async (session) => {
            const [cashbox] = await module_1.CashboxModel.create([
                {
                    code,
                    nameAr: payload.nameAr,
                    nameEn: payload.nameEn,
                    branchId,
                    isMainCashbox: Boolean(payload.isMainCashbox),
                    currency: payload.currency || "EGP",
                    openingBalance,
                    totalInflows: 0,
                    totalOutflows: 0,
                    currentBalance: openingBalance,
                    status: "OPEN",
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            if (openingBalance > 0) {
                const amountInEgp = utils_1.Money.convert(openingBalance, payload.exchangeRateToEgp || 1);
                const je = await accounting_1.accountingService.postJournalEntry({
                    description: `Opening balance for cashbox ${code}`,
                    sourceModule: "CASHBOXES",
                    sourceReferenceId: cashbox._id,
                    sourceReferenceNumber: code,
                    branchId,
                    lines: [
                        { accountCode: "1101", debit: amountInEgp, memo: `Opening cashbox ${code}` },
                        { accountCode: "3101", credit: amountInEgp, memo: `Opening equity for cashbox ${code}` },
                    ],
                    actorId: req.user?._id,
                    session,
                });
                await module_1.FinancialTransactionModel.create([
                    {
                        cashboxId: cashbox._id,
                        branchId,
                        direction: "INFLOW",
                        type: "OPENING_BALANCE",
                        amount: openingBalance,
                        currency: cashbox.currency,
                        amountInEgp,
                        runningCashboxBalance: openingBalance,
                        referenceType: "Cashbox",
                        referenceId: cashbox._id,
                        referenceNumber: code,
                        journalEntryId: je._id,
                        description: "Cashbox opening balance",
                        createdBy: req.user?._id,
                    },
                ], session ? { session } : undefined);
            }
            await service_1.auditService.record({
                req,
                action: "CASHBOX_CREATED",
                module: "cashboxes",
                entityType: "Cashbox",
                entityId: cashbox._id.toString(),
                branchId,
                newValues: cashbox.toObject(),
                session,
            });
            return cashbox;
        });
    }
    async reconcileAndCloseDaily(cashboxId, actualCountedBalance, notes, req) {
        return await (0, utils_1.withTransaction)(async (session) => {
            const filter = { _id: cashboxId };
            Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
            const cashbox = await module_1.CashboxModel.findOne(filter, null, session ? { session } : undefined);
            if (!cashbox)
                throw new exception_1.NotFoundException("Cashbox not found in your branch scope");
            const counted = utils_1.Money.round(actualCountedBalance);
            const discrepancyAmount = utils_1.Money.subtract(counted, cashbox.currentBalance);
            const [closure] = await module_1.CashboxClosureModel.create([
                {
                    cashboxId: cashbox._id,
                    branchId: cashbox.branchId,
                    closingDate: new Date(),
                    expectedSystemBalance: cashbox.currentBalance,
                    actualCountedBalance: counted,
                    discrepancyAmount,
                    notes,
                    closedBy: req.user._id,
                },
            ], session ? { session } : undefined);
            cashbox.lastClosedAt = new Date();
            await cashbox.save(session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "CASHBOX_DAILY_CLOSING",
                module: "cashboxes",
                entityType: "CashboxClosure",
                entityId: closure._id.toString(),
                branchId: cashbox.branchId,
                newValues: closure.toObject(),
                session,
            });
            const discrepancyLabel = discrepancyAmount === 0
                ? "✅ مطابق تماماً (بدون عجز أو زيادة)"
                : discrepancyAmount < 0
                    ? `⚠️ عجز بقيمة ${Math.abs(discrepancyAmount)} ${cashbox.currency}`
                    : `ℹ️ زيادة بقيمة ${discrepancyAmount} ${cashbox.currency}`;
            service_1.telegramService
                .notifyAdmins([
                `🔒 <b>تقفيل وجرد يومي للخزينة</b>`,
                `• الخزينة: <b>${cashbox.nameAr}</b> [${cashbox.code}]`,
                `• الرصيد الدفتري بالنظام: ${cashbox.currentBalance} ${cashbox.currency}`,
                `• الرصيد الفعلي المعدود: ${counted} ${cashbox.currency}`,
                `• نتيجة المطابقة: <b>${discrepancyLabel}</b>`,
            ].join("\n"))
                .catch(() => { });
            return { cashbox, closure: closure };
        });
    }
}
exports.CashboxService = CashboxService;
exports.cashboxService = new CashboxService();
