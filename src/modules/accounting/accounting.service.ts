import mongoose, { ClientSession } from "mongoose";
import {
  AccountModel,
  IAccount,
  IJournalEntry,
  JournalEntryModel,
} from "../../DB/module";
import {
  AccountingIntegrityError,
  NotFoundException,
} from "../../common/exception";
import { sequenceService } from "../../common/service";
import { Money } from "../../common/utils";

/**
 * Default Enterprise Chart of Accounts for Troziana Umrah Operations.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  code: string;
  nameAr: string;
  nameEn: string;
  type: IAccount["type"];
  normalBalance: IAccount["normalBalance"];
}> = [
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

export class AccountingService {
  async ensureChartOfAccounts(session?: ClientSession) {
    for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
      await AccountModel.updateOne(
        { code: acc.code },
        {
          $setOnInsert: {
            ...acc,
            isSystemAccount: true,
            isActive: true,
            totalDebits: 0,
            totalCredits: 0,
            currentBalance: 0,
          },
        },
        { upsert: true, ...(session ? { session } : {}) },
      );
    }
  }

  /**
   * Automatically posts a balanced journal entry from financial operations (Receipts, Expenses, Transfers, Cashboxes).
   */
  async postJournalEntry({
    entryDate = new Date(),
    description,
    sourceModule,
    sourceReferenceId,
    sourceReferenceNumber,
    branchId,
    tripId,
    lines,
    actorId,
    session,
  }: {
    entryDate?: Date;
    description: string;
    sourceModule: IJournalEntry["sourceModule"];
    sourceReferenceId?: string | mongoose.Types.ObjectId | undefined;
    sourceReferenceNumber?: string | undefined;
    branchId?: string | mongoose.Types.ObjectId | null | undefined;
    tripId?: string | mongoose.Types.ObjectId | null | undefined;
    lines: Array<{
      accountCode: string;
      debit?: number;
      credit?: number;
      memo?: string | undefined;
      branchId?: string | mongoose.Types.ObjectId | null | undefined;
      tripId?: string | mongoose.Types.ObjectId | null | undefined;
    }>;
    actorId?: string | mongoose.Types.ObjectId | undefined;
    session?: ClientSession | undefined;
  }) {
    if (!lines || lines.length < 2) {
      throw new AccountingIntegrityError("A journal entry must contain at least 2 lines");
    }

    await this.ensureChartOfAccounts(session);

    let totalDebit = 0;
    let totalCredit = 0;
    const resolvedLines = [];

    for (const line of lines) {
      const debit = Money.round(line.debit || 0);
      const credit = Money.round(line.credit || 0);
      if (debit < 0 || credit < 0 || (debit === 0 && credit === 0) || (debit > 0 && credit > 0)) {
        throw new AccountingIntegrityError(
          `Invalid journal line for account ${line.accountCode}: must have either positive debit or positive credit`,
        );
      }

      const account = await AccountModel.findOne(
        { code: line.accountCode, isActive: true },
        null,
        session ? { session } : undefined,
      );
      if (!account) {
        throw new NotFoundException(`Active account with code ${line.accountCode} not found in Chart of Accounts`);
      }

      totalDebit = Money.add(totalDebit, debit);
      totalCredit = Money.add(totalCredit, credit);

      resolvedLines.push({
        accountId: account._id!,
        accountCode: account.code,
        accountName: account.nameEn,
        branchId: line.branchId
          ? new mongoose.Types.ObjectId(line.branchId.toString())
          : branchId
            ? new mongoose.Types.ObjectId(branchId.toString())
            : null,
        tripId: line.tripId
          ? new mongoose.Types.ObjectId(line.tripId.toString())
          : tripId
            ? new mongoose.Types.ObjectId(tripId.toString())
            : null,
        debit,
        credit,
        memo: line.memo,
      });
    }

    if (!Money.equals(totalDebit, totalCredit)) {
      throw new AccountingIntegrityError(
        `Unbalanced journal entry rejected: Total Debits (${totalDebit}) !== Total Credits (${totalCredit})`,
      );
    }

    for (const rLine of resolvedLines) {
      const acc = await AccountModel.findById(rLine.accountId, null, session ? { session } : undefined);
      if (acc) {
        acc.totalDebits = Money.add(acc.totalDebits, rLine.debit);
        acc.totalCredits = Money.add(acc.totalCredits, rLine.credit);
        acc.currentBalance =
          acc.normalBalance === "DEBIT"
            ? Money.subtract(acc.totalDebits, acc.totalCredits)
            : Money.subtract(acc.totalCredits, acc.totalDebits);
        await acc.save(session ? { session } : undefined);
      }
    }

    const entryNumber = await sequenceService.nextReference({
      documentType: "JOURNAL_ENTRY",
      prefix: "JE",
      session,
    });

    const [entry] = await JournalEntryModel.create(
      [
        {
          entryNumber,
          entryDate,
          description,
          sourceModule,
          sourceReferenceId: sourceReferenceId ? new mongoose.Types.ObjectId(sourceReferenceId.toString()) : undefined,
          sourceReferenceNumber,
          branchId: branchId ? new mongoose.Types.ObjectId(branchId.toString()) : null,
          tripId: tripId ? new mongoose.Types.ObjectId(tripId.toString()) : null,
          lines: resolvedLines,
          totalDebit,
          totalCredit,
          status: "POSTED",
          postedBy: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : undefined,
        },
      ],
      session ? { session } : undefined,
    );

    return entry!;
  }

  async getFinancialStatements() {
    await this.ensureChartOfAccounts();
    const accounts = await AccountModel.find({ isActive: true }).sort({ code: 1 }).lean();

    const revenues = accounts.filter((a) => a.type === "REVENUE");
    const expenses = accounts.filter((a) => a.type === "EXPENSE");
    const assets = accounts.filter((a) => a.type === "ASSET");
    const liabilities = accounts.filter((a) => a.type === "LIABILITY");
    const equity = accounts.filter((a) => a.type === "EQUITY");

    const totalRevenue = revenues.reduce((s, a) => Money.add(s, a.currentBalance), 0);
    const totalExpenses = expenses.reduce((s, a) => Money.add(s, a.currentBalance), 0);
    const netAccountingProfit = Money.subtract(totalRevenue, totalExpenses);

    const totalAssets = assets.reduce((s, a) => Money.add(s, a.currentBalance), 0);
    const totalLiabilities = liabilities.reduce((s, a) => Money.add(s, a.currentBalance), 0);
    const totalEquity = Money.add(
      equity.reduce((s, a) => Money.add(s, a.currentBalance), 0),
      netAccountingProfit,
    );

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
        isBalanced: Money.equals(totalAssets, Money.add(totalLiabilities, totalEquity)),
      },
    };
  }
}

export const accountingService = new AccountingService();
