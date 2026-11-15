"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingService = exports.AccountingService = exports.DEFAULT_CHART_OF_ACCOUNTS = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
exports.DEFAULT_CHART_OF_ACCOUNTS = [
    { code: "1101", nameAr: "النقدية بالخزائن والبنوك", nameEn: "Cash & Cashboxes", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1102", nameAr: "ذمم عملاء وموزعي الجملة", nameEn: "Accounts Receivable - Customers & Wholesale", type: "ASSET", normalBalance: "DEBIT" },
    { code: "1103", nameAr: "تحويلات نقدية بين الخزائن بالطريق", nameEn: "Inter-Cashbox Transfers Clearing", type: "ASSET", normalBalance: "DEBIT" },
    { code: "2101", nameAr: "دفعات مقدمة من المعتمرين (إيرادات غير مكتسبة)", nameEn: "Customer Advances (Unearned Umrah Revenue)", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "2102", nameAr: "موردون - شركات الطيران والفنادق والوكلاء", nameEn: "Accounts Payable - Suppliers", type: "LIABILITY", normalBalance: "CREDIT" },
    { code: "3101", nameAr: "رأس المال والأرباح المبقاة", nameEn: "Owner Equity & Opening Capital", type: "EQUITY", normalBalance: "CREDIT" },
    { code: "4101", nameAr: "إيرادات رحلات العمرة المحققة", nameEn: "Recognized Umrah Trip Revenue", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "4102", nameAr: "إيرادات مبيعات الجملة", nameEn: "Wholesale Umrah Revenue", type: "REVENUE", normalBalance: "CREDIT" },
    { code: "5101", nameAr: "تكلفة مشتريات الطيران", nameEn: "Flight Procurement Cost", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5102", nameAr: "تكلفة عقود الفنادق (مكة والمدينة)", nameEn: "Hotel Procurement Cost", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5103", nameAr: "مصاريف تشغيل العمرة والباركود والمشرفين", nameEn: "Umrah Operational & Visa Expenses", type: "EXPENSE", normalBalance: "DEBIT" },
    { code: "5201", nameAr: "مصاريف عمومية وإدارية بالفروع", nameEn: "Branch General & Administrative Expenses", type: "EXPENSE", normalBalance: "DEBIT" },
];
class AccountingService {
    async ensureChartOfAccounts(session) {
        for (const acc of exports.DEFAULT_CHART_OF_ACCOUNTS) {
            await module_1.AccountModel.updateOne({ code: acc.code }, {
                $setOnInsert: {
                    ...acc,
                    isSystemAccount: true,
                    isActive: true,
                    totalDebits: 0,
                    totalCredits: 0,
                    currentBalance: 0,
                },
            }, { upsert: true, ...(session ? { session } : {}) });
        }
    }
    async postJournalEntry({ entryDate = new Date(), description, sourceModule, sourceReferenceId, sourceReferenceNumber, branchId, tripId, lines, actorId, session, }) {
        if (!lines || lines.length < 2) {
            throw new exception_1.AccountingIntegrityError("A journal entry must contain at least 2 lines");
        }
        await this.ensureChartOfAccounts(session);
        let totalDebit = 0;
        let totalCredit = 0;
        const resolvedLines = [];
        for (const line of lines) {
            const debit = utils_1.Money.round(line.debit || 0);
            const credit = utils_1.Money.round(line.credit || 0);
            if (debit < 0 || credit < 0 || (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
                throw new exception_1.AccountingIntegrityError(`Invalid journal line for account ${line.accountCode}: must have either positive debit or positive credit`);
            }
            const account = await module_1.AccountModel.findOne({ code: line.accountCode, isActive: true }, null, session ? { session } : undefined);
            if (!account) {
                throw new exception_1.NotFoundException(`Active account with code ${line.accountCode} not found in Chart of Accounts`);
            }
            totalDebit = utils_1.Money.add(totalDebit, debit);
            totalCredit = utils_1.Money.add(totalCredit, credit);
            resolvedLines.push({
                accountId: account._id,
                accountCode: account.code,
                accountName: account.nameEn,
                branchId: line.branchId
                    ? new mongoose_1.default.Types.ObjectId(line.branchId.toString())
                    : branchId
                        ? new mongoose_1.default.Types.ObjectId(branchId.toString())
                        : null,
                tripId: line.tripId
                    ? new mongoose_1.default.Types.ObjectId(line.tripId.toString())
                    : tripId
                        ? new mongoose_1.default.Types.ObjectId(tripId.toString())
                        : null,
                debit,
                credit,
                memo: line.memo,
            });
        }
        if (!utils_1.Money.equals(totalDebit, totalCredit)) {
            throw new exception_1.AccountingIntegrityError(`Unbalanced journal entry rejected: Total Debits (${totalDebit}) !== Total Credits (${totalCredit})`);
        }
        for (const rLine of resolvedLines) {
            const acc = await module_1.AccountModel.findById(rLine.accountId, null, session ? { session } : undefined);
            if (acc) {
                acc.totalDebits = utils_1.Money.add(acc.totalDebits, rLine.debit);
                acc.totalCredits = utils_1.Money.add(acc.totalCredits, rLine.credit);
                acc.currentBalance =
                    acc.normalBalance === "DEBIT"
                        ? utils_1.Money.subtract(acc.totalDebits, acc.totalCredits)
                        : utils_1.Money.subtract(acc.totalCredits, acc.totalDebits);
                await acc.save(session ? { session } : undefined);
            }
        }
        const entryNumber = await service_1.sequenceService.nextReference({
            documentType: "JOURNAL_ENTRY",
            prefix: "JE",
            session,
        });
        const [entry] = await module_1.JournalEntryModel.create([
            {
                entryNumber,
                entryDate,
                description,
                sourceModule,
                sourceReferenceId: sourceReferenceId ? new mongoose_1.default.Types.ObjectId(sourceReferenceId.toString()) : undefined,
                sourceReferenceNumber,
                branchId: branchId ? new mongoose_1.default.Types.ObjectId(branchId.toString()) : null,
                tripId: tripId ? new mongoose_1.default.Types.ObjectId(tripId.toString()) : null,
                lines: resolvedLines,
                totalDebit,
                totalCredit,
                status: "POSTED",
                postedBy: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : undefined,
            },
        ], session ? { session } : undefined);
        return entry;
    }
    async getFinancialStatements() {
        await this.ensureChartOfAccounts();
        const accounts = await module_1.AccountModel.find({ isActive: true }).sort({ code: 1 }).lean();
        const revenues = accounts.filter((a) => a.type === "REVENUE");
        const expenses = accounts.filter((a) => a.type === "EXPENSE");
        const assets = accounts.filter((a) => a.type === "ASSET");
        const liabilities = accounts.filter((a) => a.type === "LIABILITY");
        const equity = accounts.filter((a) => a.type === "EQUITY");
        const totalRevenue = revenues.reduce((s, a) => utils_1.Money.add(s, a.currentBalance), 0);
        const totalExpenses = expenses.reduce((s, a) => utils_1.Money.add(s, a.currentBalance), 0);
        const netAccountingProfit = utils_1.Money.subtract(totalRevenue, totalExpenses);
        const totalAssets = assets.reduce((s, a) => utils_1.Money.add(s, a.currentBalance), 0);
        const totalLiabilities = liabilities.reduce((s, a) => utils_1.Money.add(s, a.currentBalance), 0);
        const totalEquity = utils_1.Money.add(equity.reduce((s, a) => utils_1.Money.add(s, a.currentBalance), 0), netAccountingProfit);
        return {
            profitAndLoss: {
                revenues,
                expenses,
                totalRevenue,
                totalExpenses,
                netAccountingProfit,
            },
            balanceSheet: {
                assets,
                liabilities,
                equity,
                totalAssets,
                totalLiabilities,
                totalEquity,
                isBalanced: utils_1.Money.equals(totalAssets, utils_1.Money.add(totalLiabilities, totalEquity)),
            },
        };
    }
}
exports.AccountingService = AccountingService;
exports.accountingService = new AccountingService();
