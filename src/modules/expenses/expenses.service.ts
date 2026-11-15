import { Request } from "express";
import {
  BranchModel,
  CashboxModel,
  ExpenseModel,
  FinancialTransactionModel,
  FlightLotModel,
  HotelContractModel,
} from "../../DB/module";
import { BadRequestException, InsufficientBalanceError } from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { assertBranchAccess } from "../../middleware";
import { Money, withTransaction } from "../../common/utils";
import { accountingService } from "../accounting";
import { supplierService } from "../suppliers";

export class ExpenseService {
  /**
   * Atomically records an Operational Expense or Supplier Payment Voucher.
   */
  async createExpenseOrSupplierPayment(payload: any, req: Request) {
    const branchId = assertBranchAccess(req.branchContext, payload.branchId);
    const amount = Money.round(payload.amount);
    if (amount <= 0) throw new BadRequestException("Expense amount must be positive");

    return await withTransaction(async (session) => {
      const cashbox = await CashboxModel.findOneAndUpdate(
        {
          _id: payload.cashboxId,
          branchId,
          status: "OPEN",
          currentBalance: { $gte: amount },
        },
        {
          $inc: {
            totalOutflows: amount,
            currentBalance: -amount,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!cashbox) {
        throw new InsufficientBalanceError("Active cashbox not found or has insufficient balance for this payment");
      }

      const rate = Money.roundRate(payload.exchangeRateToEgp || 1);
      const amountInEgp = Money.convert(amount, rate);

      const branchDoc = await BranchModel.findById(branchId, "code", session ? { session } : undefined);
      const isSupplierPayment = payload.voucherType === "SUPPLIER_PAYMENT" || Boolean(payload.supplierId);

      const voucherNumber = await sequenceService.nextReference({
        documentType: isSupplierPayment ? "PAYMENT_VOUCHER" : "EXPENSE",
        branchCode: branchDoc?.code || "BR",
        session,
      });

      const debitAccountCode = isSupplierPayment
        ? "2102"
        : payload.tripId
          ? "5103"
          : "5201";

      const journalEntry = await accountingService.postJournalEntry({
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

      const [expense] = await ExpenseModel.create(
        [
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
        ],
        session ? { session } : undefined,
      );

      await FinancialTransactionModel.create(
        [
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
            referenceId: expense!._id,
            referenceNumber: voucherNumber,
            journalEntryId: journalEntry._id,
            description: payload.description,
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      if (payload.supplierId) {
        await supplierService.recordLedgerMovement({
          supplierId: payload.supplierId,
          branchId,
          entryType: "PARTIAL_PAYMENT",
          referenceType: "PAYMENT_VOUCHER",
          referenceId: expense!._id,
          referenceNumber: voucherNumber,
          description: payload.description,
          debitAmount: amount,
          exchangeRateToEgp: rate,
          actorId: req.user?._id,
          session,
        });
      }

      if (payload.flightLotId) {
        const lot = await FlightLotModel.findById(payload.flightLotId, null, session ? { session } : undefined);
        if (lot) {
          lot.paidAmount = Money.add(lot.paidAmount, amount);
          lot.remainingLiability = Math.max(0, Money.subtract(lot.totalCost, lot.paidAmount));
          await lot.save(session ? { session } : undefined);
        }
      }

      if (payload.hotelContractId) {
        const hc = await HotelContractModel.findById(payload.hotelContractId, null, session ? { session } : undefined);
        if (hc) {
          hc.paidAmount = Money.add(hc.paidAmount, amount);
          hc.remainingLiability = Math.max(0, Money.subtract(hc.contractValue, hc.paidAmount));
          await hc.save(session ? { session } : undefined);
        }
      }

      await auditService.record({
        req,
        action: isSupplierPayment ? "SUPPLIER_PAYMENT_CREATED" : "EXPENSE_CREATED",
        module: "expenses",
        entityType: "Expense",
        entityId: expense!._id.toString(),
        branchId,
        newValues: expense!.toObject(),
        session,
      });

      return expense!;
    });
  }
}

export const expenseService = new ExpenseService();
