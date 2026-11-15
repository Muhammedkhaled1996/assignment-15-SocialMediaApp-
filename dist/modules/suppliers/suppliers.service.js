"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supplierService = exports.SupplierService = exports.SupplierRepository = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
class SupplierRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.SupplierModel);
    }
}
exports.SupplierRepository = SupplierRepository;
class SupplierService {
    repo = new SupplierRepository();
    async listSuppliers(query) {
        const filter = {};
        if (query.type)
            filter.type = query.type;
        if (query.status)
            filter.status = query.status;
        if (query.currency)
            filter.currency = query.currency;
        return await this.repo.paginate({
            filter,
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 25,
        });
    }
    async createSupplier(payload, req) {
        const code = payload.code.toUpperCase().trim();
        const existing = await this.repo.findOne({ filter: { code } });
        if (existing) {
            throw new exception_1.ConflictException(`Supplier with code ${code} already exists`);
        }
        const openingBalance = utils_1.Money.round(payload.openingBalance ?? 0);
        return await (0, utils_1.withTransaction)(async (session) => {
            const [supplier] = await module_1.SupplierModel.create([
                {
                    ...payload,
                    code,
                    openingBalance,
                    totalObligations: 0,
                    totalPayments: 0,
                    currentBalance: openingBalance,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            if (openingBalance !== 0) {
                await module_1.SupplierLedgerEntryModel.create([
                    {
                        supplierId: supplier._id,
                        entryType: "OPENING_BALANCE",
                        referenceType: "SUPPLIER",
                        referenceId: supplier._id,
                        referenceNumber: code,
                        description: "Opening balance",
                        currency: supplier.currency,
                        debitAmount: openingBalance < 0 ? Math.abs(openingBalance) : 0,
                        creditAmount: openingBalance > 0 ? openingBalance : 0,
                        runningBalance: openingBalance,
                        exchangeRateToEgp: payload.exchangeRateToEgp || 1,
                        amountInEgp: utils_1.Money.convert(Math.abs(openingBalance), payload.exchangeRateToEgp || 1),
                        effectiveDate: new Date(),
                        createdBy: req.user?._id,
                    },
                ], session ? { session } : undefined);
            }
            await service_1.auditService.record({
                req,
                action: "SUPPLIER_CREATED",
                module: "suppliers",
                entityType: "Supplier",
                entityId: supplier._id.toString(),
                newValues: supplier.toObject(),
                session,
            });
            return supplier;
        });
    }
    async recordLedgerMovement({ supplierId, branchId, entryType, referenceType, referenceId, referenceNumber, description, debitAmount = 0, creditAmount = 0, exchangeRateToEgp = 1, dueDate, effectiveDate = new Date(), actorId, session, }) {
        const supplier = await module_1.SupplierModel.findById(supplierId, null, session ? { session } : undefined);
        if (!supplier) {
            throw new exception_1.NotFoundException("Supplier not found");
        }
        const debit = utils_1.Money.round(debitAmount);
        const credit = utils_1.Money.round(creditAmount);
        if (debit < 0 || credit < 0 || (debit === 0 && credit === 0)) {
            throw new exception_1.BadRequestException("Ledger movement must have a positive debit or credit amount");
        }
        const newObligations = utils_1.Money.add(supplier.totalObligations, credit);
        const newPayments = utils_1.Money.add(supplier.totalPayments, debit);
        const runningBalance = utils_1.Money.subtract(utils_1.Money.add(supplier.openingBalance, newObligations), newPayments);
        supplier.totalObligations = newObligations;
        supplier.totalPayments = newPayments;
        supplier.currentBalance = runningBalance;
        await supplier.save(session ? { session } : undefined);
        const netMovement = credit > 0 ? credit : debit;
        const [entry] = await module_1.SupplierLedgerEntryModel.create([
            {
                supplierId: supplier._id,
                branchId: branchId ? new mongoose_1.default.Types.ObjectId(branchId.toString()) : null,
                entryType,
                referenceType,
                referenceId: new mongoose_1.default.Types.ObjectId(referenceId.toString()),
                referenceNumber,
                description,
                currency: supplier.currency,
                debitAmount: debit,
                creditAmount: credit,
                runningBalance,
                exchangeRateToEgp: utils_1.Money.roundRate(exchangeRateToEgp),
                amountInEgp: utils_1.Money.convert(netMovement, exchangeRateToEgp),
                dueDate,
                isPaid: debit > 0,
                effectiveDate,
                createdBy: actorId ? new mongoose_1.default.Types.ObjectId(actorId.toString()) : undefined,
            },
        ], session ? { session } : undefined);
        return { entry: entry, supplier };
    }
    async getSupplierStatement(supplierId, query = {}) {
        const supplier = await module_1.SupplierModel.findById(supplierId).lean();
        if (!supplier) {
            throw new exception_1.NotFoundException("Supplier not found");
        }
        const filter = { supplierId: new mongoose_1.default.Types.ObjectId(supplierId) };
        if (query.fromDate || query.toDate) {
            filter.effectiveDate = {};
            if (query.fromDate)
                filter.effectiveDate.$gte = new Date(query.fromDate);
            if (query.toDate)
                filter.effectiveDate.$lte = new Date(query.toDate);
        }
        const entries = await module_1.SupplierLedgerEntryModel.find(filter).sort({ effectiveDate: 1, _id: 1 }).lean();
        let totalCredits = 0;
        let totalDebits = 0;
        for (const e of entries) {
            totalCredits = utils_1.Money.add(totalCredits, e.creditAmount);
            totalDebits = utils_1.Money.add(totalDebits, e.debitAmount);
        }
        const calculatedBalance = utils_1.Money.subtract(totalCredits, totalDebits);
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
        const suppliers = await module_1.SupplierModel.find({ status: "ACTIVE" }).lean();
        const unpaidObligations = await module_1.SupplierLedgerEntryModel.find({
            entryType: "CONTRACT_OBLIGATION",
            isPaid: false,
            dueDate: { $exists: true },
        })
            .populate("supplierId", "code nameAr nameEn currency")
            .sort({ dueDate: 1 })
            .lean();
        const buckets = {
            upcoming: [],
            overdue0to30: [],
            overdue31to60: [],
            overdue61to90: [],
            overdue90Plus: [],
        };
        for (const item of unpaidObligations) {
            if (!item.dueDate)
                continue;
            const diffDays = Math.floor((now.getTime() - new Date(item.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            const enriched = { ...item, daysOverdue: Math.max(0, diffDays) };
            if (diffDays < 0) {
                buckets.upcoming.push(enriched);
            }
            else if (diffDays <= 30) {
                buckets.overdue0to30.push(enriched);
            }
            else if (diffDays <= 60) {
                buckets.overdue31to60.push(enriched);
            }
            else if (diffDays <= 90) {
                buckets.overdue61to90.push(enriched);
            }
            else {
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
exports.SupplierService = SupplierService;
exports.supplierService = new SupplierService();
exports.default = exports.supplierService;
