import { Request } from "express";
import mongoose, { ClientSession } from "mongoose";
import { SupplierLedgerEntryModel, SupplierModel, ISupplierLedgerEntry } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception";
import { auditService } from "../../common/service";
import { Money, withTransaction } from "../../common/utils";

export class SupplierRepository extends DatabaseRepository<any> {
  constructor() {
    super(SupplierModel);
  }
}

export class SupplierService {
  private repo = new SupplierRepository();

  async listSuppliers(query: Record<string, string>) {
    const filter: Record<string, any> = {};
    if (query.type) filter.type = query.type;
    if (query.status) filter.status = query.status;
    if (query.currency) filter.currency = query.currency;
    return await this.repo.paginate({
      filter,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 25,
    });
  }

  async createSupplier(payload: any, req: Request) {
    const code = payload.code.toUpperCase().trim();
    const existing = await this.repo.findOne({ filter: { code } });
    if (existing) {
      throw new ConflictException(`Supplier with code ${code} already exists`);
    }

    const openingBalance = Money.round(payload.openingBalance ?? 0);

    return await withTransaction(async (session) => {
      const [supplier] = await SupplierModel.create(
        [
          {
            ...payload,
            code,
            openingBalance,
            totalObligations: 0,
            totalPayments: 0,
            currentBalance: openingBalance,
            createdBy: req.user?._id,
          },
        ],
        session ? { session } : undefined,
      );

      if (openingBalance !== 0) {
        await SupplierLedgerEntryModel.create(
          [
            {
              supplierId: supplier!._id,
              entryType: "OPENING_BALANCE",
              referenceType: "SUPPLIER",
              referenceId: supplier!._id,
              referenceNumber: code,
              description: "Opening balance",
              currency: supplier!.currency,
              debitAmount: openingBalance < 0 ? Math.abs(openingBalance) : 0,
              creditAmount: openingBalance > 0 ? openingBalance : 0,
              runningBalance: openingBalance,
              exchangeRateToEgp: payload.exchangeRateToEgp || 1,
              amountInEgp: Money.convert(Math.abs(openingBalance), payload.exchangeRateToEgp || 1),
              effectiveDate: new Date(),
              createdBy: req.user?._id,
            },
          ],
          session ? { session } : undefined,
        );
      }

      await auditService.record({
        req,
        action: "SUPPLIER_CREATED",
        module: "suppliers",
        entityType: "Supplier",
        entityId: supplier!._id.toString(),
        newValues: supplier!.toObject(),
        session,
      });

      return supplier!;
    });
  }

  async recordLedgerMovement({
    supplierId,
    branchId,
    entryType,
    referenceType,
    referenceId,
    referenceNumber,
    description,
    debitAmount = 0,
    creditAmount = 0,
    exchangeRateToEgp = 1,
    dueDate,
    effectiveDate = new Date(),
    actorId,
    session,
  }: {
    supplierId: string | mongoose.Types.ObjectId;
    branchId?: string | mongoose.Types.ObjectId | null | undefined;
    entryType: ISupplierLedgerEntry["entryType"];
    referenceType: ISupplierLedgerEntry["referenceType"];
    referenceId: string | mongoose.Types.ObjectId;
    referenceNumber?: string | undefined;
    description: string;
    debitAmount?: number;
    creditAmount?: number;
    exchangeRateToEgp?: number;
    dueDate?: Date | undefined;
    effectiveDate?: Date;
    actorId?: string | mongoose.Types.ObjectId | undefined;
    session?: ClientSession | undefined;
  }) {
    const supplier = await SupplierModel.findById(supplierId, null, session ? { session } : undefined);
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    const debit = Money.round(debitAmount);
    const credit = Money.round(creditAmount);
    if (debit < 0 || credit < 0 || (debit === 0 && credit === 0)) {
      throw new BadRequestException("Ledger movement must have a positive debit or credit amount");
    }

    const newObligations = Money.add(supplier.totalObligations, credit);
    const newPayments = Money.add(supplier.totalPayments, debit);
    const runningBalance = Money.subtract(Money.add(supplier.openingBalance, newObligations), newPayments);

    supplier.totalObligations = newObligations;
    supplier.totalPayments = newPayments;
    supplier.currentBalance = runningBalance;
    await supplier.save(session ? { session } : undefined);

    const netMovement = credit > 0 ? credit : debit;
    const [entry] = await SupplierLedgerEntryModel.create(
      [
        {
          supplierId: supplier._id,
          branchId: branchId ? new mongoose.Types.ObjectId(branchId.toString()) : null,
          entryType,
          referenceType,
          referenceId: new mongoose.Types.ObjectId(referenceId.toString()),
          referenceNumber,
          description,
          currency: supplier.currency,
          debitAmount: debit,
          creditAmount: credit,
          runningBalance,
          exchangeRateToEgp: Money.roundRate(exchangeRateToEgp),
          amountInEgp: Money.convert(netMovement, exchangeRateToEgp),
          dueDate,
          isPaid: debit > 0,
          effectiveDate,
          createdBy: actorId ? new mongoose.Types.ObjectId(actorId.toString()) : undefined,
        },
      ],
      session ? { session } : undefined,
    );

    return { entry: entry!, supplier };
  }

  async getSupplierStatement(supplierId: string, query: { fromDate?: string; toDate?: string } = {}) {
    const supplier = await SupplierModel.findById(supplierId).lean();
    if (!supplier) {
      throw new NotFoundException("Supplier not found");
    }

    const filter: Record<string, any> = { supplierId: new mongoose.Types.ObjectId(supplierId) };
    if (query.fromDate || query.toDate) {
      filter.effectiveDate = {};
      if (query.fromDate) filter.effectiveDate.$gte = new Date(query.fromDate);
      if (query.toDate) filter.effectiveDate.$lte = new Date(query.toDate);
    }

    const entries = await SupplierLedgerEntryModel.find(filter).sort({ effectiveDate: 1, _id: 1 }).lean();

    let totalCredits = 0;
    let totalDebits = 0;
    for (const e of entries) {
      totalCredits = Money.add(totalCredits, e.creditAmount);
      totalDebits = Money.add(totalDebits, e.debitAmount);
    }
    const calculatedBalance = Money.subtract(totalCredits, totalDebits);

    return {
      supplier,
      summary: {
        currency: supplier.currency,
        totalCredits,
        totalDebits,
        calculatedBalance,
        currentBalance: supplier.currentBalance,
      },
      entries,
    };
  }

  async getAgingAndScheduleReport() {
    const now = new Date();
    const suppliers = await SupplierModel.find({ status: "ACTIVE" }).lean();
    const unpaidObligations = await SupplierLedgerEntryModel.find({
      entryType: "CONTRACT_OBLIGATION",
      isPaid: false,
      dueDate: { $exists: true },
    })
      .populate("supplierId", "code nameAr nameEn currency")
      .sort({ dueDate: 1 })
      .lean();

    const buckets = {
      upcoming: [] as any[],
      overdue0to30: [] as any[],
      overdue31to60: [] as any[],
      overdue61to90: [] as any[],
      overdue90Plus: [] as any[],
    };

    for (const item of unpaidObligations) {
      if (!item.dueDate) continue;
      const diffDays = Math.floor((now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24));
      const enriched = { ...item, daysOverdue: Math.max(0, diffDays) };
      if (diffDays < 0) {
        buckets.upcoming.push(enriched);
      } else if (diffDays <= 30) {
        buckets.overdue0to30.push(enriched);
      } else if (diffDays <= 60) {
        buckets.overdue31to60.push(enriched);
      } else if (diffDays <= 90) {
        buckets.overdue61to90.push(enriched);
      } else {
        buckets.overdue90Plus.push(enriched);
      }
    }

    return {
      generatedAt: now,
      suppliersSummary: suppliers.map((s) => ({
        supplierId: s._id,
        code: s.code,
        nameAr: s.nameAr,
        nameEn: s.nameEn,
        type: s.type,
        currency: s.currency,
        currentBalance: s.currentBalance,
      })),
      agingBuckets: buckets,
    };
  }
}

export const supplierService = new SupplierService();
export default supplierService;
