import { Request } from "express";
import {
  CashboxModel,
  CashTransferModel,
  FinancialTransactionModel,
} from "../../DB/module";
import { BadRequestException, InsufficientBalanceError, NotFoundException } from "../../common/exception";
import { auditService, sequenceService } from "../../common/service";
import { assertBranchAccess } from "../../middleware";
import { Money, withTransaction } from "../../common/utils";
import { accountingService } from "../accounting";

export class TransferService {
  async createTransfer(payload: any, req: Request) {
    if (payload.fromCashboxId === payload.toCashboxId) {
      throw new BadRequestException("Source and destination cashboxes must be different");
    }

    const amount = Money.round(payload.amount);
    if (amount <= 0) throw new BadRequestException("Transfer amount must be positive");

    return await withTransaction(async (session) => {
      const fromCashbox = await CashboxModel.findById(payload.fromCashboxId, null, session ? { session } : undefined);
      const toCashbox = await CashboxModel.findById(payload.toCashboxId, null, session ? { session } : undefined);
      if (!fromCashbox || !toCashbox) {
        throw new NotFoundException("Source or destination cashbox not found");
      }

      assertBranchAccess(req.branchContext, fromCashbox.branchId);

      if (fromCashbox.currency !== toCashbox.currency) {
        throw new BadRequestException("Source and destination cashboxes must share the same currency");
      }

      const updatedSource = await CashboxModel.findOneAndUpdate(
        {
          _id: fromCashbox._id,
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

      if (!updatedSource) {
        throw new InsufficientBalanceError("Source cashbox does not have sufficient balance for this transfer");
      }

      const updatedDest = await CashboxModel.findOneAndUpdate(
        {
          _id: toCashbox._id,
          status: "OPEN",
        },
        {
          $inc: {
            totalInflows: amount,
            currentBalance: amount,
          },
        },
        { returnDocument: "after", ...(session ? { session } : {}) },
      );

      if (!updatedDest) {
        throw new BadRequestException("Destination cashbox is not open");
      }

      const rate = Money.roundRate(payload.exchangeRateToEgp || 1);
      const amountInEgp = Money.convert(amount, rate);

      const transferNumber = await sequenceService.nextReference({
        documentType: "TRANSFER",
        prefix: "TRF",
        session,
      });

      const journalEntry = await accountingService.postJournalEntry({
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

      const [transfer] = await CashTransferModel.create(
        [
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
        ],
        session ? { session } : undefined,
      );

      await FinancialTransactionModel.create(
        [
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
            referenceId: transfer!._id,
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
            referenceId: transfer!._id,
            referenceNumber: transferNumber,
            journalEntryId: journalEntry._id,
            description: `Transfer in from ${fromCashbox.code}`,
            createdBy: req.user?._id,
          },
        ],
        session ? { session, ordered: true } : undefined,
      );

      await auditService.record({
        req,
        action: "CASH_TRANSFER_COMPLETED",
        module: "transfers",
        entityType: "CashTransfer",
        entityId: transfer!._id.toString(),
        branchId: fromCashbox.branchId,
        newValues: transfer!.toObject(),
        session,
      });

      return transfer!;
    });
  }
}

export const transferService = new TransferService();
