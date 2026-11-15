import { Request } from "express";
import {
  CashboxClosureModel,
  CashboxModel,
  FinancialTransactionModel,
} from "../../DB/module";
import { ConflictException, NotFoundException } from "../../common/exception";
import { auditService, telegramService } from "../../common/service";
import { assertBranchAccess, resolveScopedBranchFilter } from "../../middleware";
import { Money, withTransaction } from "../../common/utils";
import { accountingService } from "../accounting";

export class CashboxService {
  async createCashbox(payload: any, req: Request) {
    const branchId = assertBranchAccess(req.branchContext, payload.branchId);
    const code = payload.code.toUpperCase().trim();

    const exists = await CashboxModel.findOne({ code });
    if (exists) throw new ConflictException(`Cashbox ${code} already exists`);

    const openingBalance = Money.round(payload.openingBalance || 0);

    return await withTransaction(async (session) => {
      const [cashbox] = await CashboxModel.create(
        [
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
        ],
        session ? { session } : undefined,
      );

      if (openingBalance > 0) {
        const amountInEgp = Money.convert(openingBalance, payload.exchangeRateToEgp || 1);
        const je = await accountingService.postJournalEntry({
          description: `Opening balance for cashbox ${code}`,
          sourceModule: "CASHBOXES",
          sourceReferenceId: cashbox!._id,
          sourceReferenceNumber: code,
          branchId,
          lines: [
            { accountCode: "1101", debit: amountInEgp, memo: `Opening cashbox ${code}` },
            { accountCode: "3101", credit: amountInEgp, memo: `Opening equity for cashbox ${code}` },
          ],
          actorId: req.user?._id,
          session,
        });

        await FinancialTransactionModel.create(
          [
            {
              cashboxId: cashbox!._id,
              branchId,
              direction: "INFLOW",
              type: "OPENING_BALANCE",
              amount: openingBalance,
              currency: cashbox!.currency,
              amountInEgp,
              runningCashboxBalance: openingBalance,
              referenceType: "Cashbox",
              referenceId: cashbox!._id,
              referenceNumber: code,
              journalEntryId: je._id,
              description: "Cashbox opening balance",
              createdBy: req.user?._id,
            },
          ],
          session ? { session } : undefined,
        );
      }

      await auditService.record({
        req,
        action: "CASHBOX_CREATED",
        module: "cashboxes",
        entityType: "Cashbox",
        entityId: cashbox!._id.toString(),
        branchId,
        newValues: cashbox!.toObject(),
        session,
      });

      return cashbox!;
    });
  }

  async reconcileAndCloseDaily(cashboxId: string, actualCountedBalance: number, notes: string | undefined, req: Request) {
    return await withTransaction(async (session) => {
      const filter: Record<string, any> = { _id: cashboxId };
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));

      const cashbox = await CashboxModel.findOne(filter, null, session ? { session } : undefined);
      if (!cashbox) throw new NotFoundException("Cashbox not found in your branch scope");

      const counted = Money.round(actualCountedBalance);
      const discrepancyAmount = Money.subtract(counted, cashbox.currentBalance);

      const [closure] = await CashboxClosureModel.create(
        [
          {
            cashboxId: cashbox._id,
            branchId: cashbox.branchId,
            closingDate: new Date(),
            expectedSystemBalance: cashbox.currentBalance,
            actualCountedBalance: counted,
            discrepancyAmount,
            notes,
            closedBy: req.user!._id!,
          },
        ],
        session ? { session } : undefined,
      );

      cashbox.lastClosedAt = new Date();
      await cashbox.save(session ? { session } : undefined);

      await auditService.record({
        req,
        action: "CASHBOX_DAILY_CLOSING",
        module: "cashboxes",
        entityType: "CashboxClosure",
        entityId: closure!._id.toString(),
        branchId: cashbox.branchId,
        newValues: closure!.toObject(),
        session,
      });

      const discrepancyLabel =
        discrepancyAmount === 0
          ? "✅ مطابق تماماً (بدون عجز أو زيادة)"
          : discrepancyAmount < 0
            ? `⚠️ عجز بقيمة ${Math.abs(discrepancyAmount)} ${cashbox.currency}`
            : `ℹ️ زيادة بقيمة ${discrepancyAmount} ${cashbox.currency}`;

      telegramService
        .notifyAdmins(
          [
            `🔒 <b>تقفيل وجرد يومي للخزينة</b>`,
            `• الخزينة: <b>${cashbox.nameAr}</b> [${cashbox.code}]`,
            `• الرصيد الدفتري بالنظام: ${cashbox.currentBalance} ${cashbox.currency}`,
            `• الرصيد الفعلي المعدود: ${counted} ${cashbox.currency}`,
            `• نتيجة المطابقة: <b>${discrepancyLabel}</b>`,
          ].join("\n"),
        )
        .catch(() => {});

      return { cashbox, closure: closure! };
    });
  }
}

export const cashboxService = new CashboxService();
