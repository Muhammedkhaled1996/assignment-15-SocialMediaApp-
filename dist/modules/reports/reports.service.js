"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportService = exports.ReportService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const utils_1 = require("../../common/utils");
class ReportService {
    async getTripProfitabilityReport(query) {
        const tripFilter = {};
        if (query.tripId)
            tripFilter._id = new mongoose_1.default.Types.ObjectId(query.tripId);
        if (query.season)
            tripFilter.season = query.season;
        const trips = await module_1.TripModel.find(tripFilter).populate("approvedPricingVersionId").lean();
        const results = [];
        for (const trip of trips) {
            const pricing = trip.approvedPricingVersionId;
            const forecastRevenueEgp = pricing?.totals?.estimatedTotalGroupRevenueEgp || 0;
            const forecastCostEgp = pricing?.totals?.estimatedTotalGroupCostEgp || 0;
            const forecastProfitEgp = pricing?.totals?.expectedGroupProfitEgp || 0;
            const [bookingAgg] = await module_1.BookingModel.aggregate([
                {
                    $match: {
                        tripId: trip._id,
                        status: { $in: ["CONFIRMED", "COMPLETED"] },
                    },
                },
                {
                    $group: {
                        _id: "$tripId",
                        bookingsCount: { $sum: 1 },
                        operationalRevenueEgp: { $sum: "$netSellingPrice" },
                        collectedCashEgp: { $sum: "$amountPaid" },
                        outstandingReceivablesEgp: { $sum: "$remainingBalance" },
                        snapshotCostEgp: { $sum: "$priceSnapshot.costPerPassengerEgp" },
                    },
                },
            ]);
            const operationalRevenueEgp = utils_1.Money.round(bookingAgg?.operationalRevenueEgp || 0);
            const operationalCostEgp = utils_1.Money.round(bookingAgg?.snapshotCostEgp || 0);
            const operationalActualProfitEgp = utils_1.Money.subtract(operationalRevenueEgp, operationalCostEgp);
            const journalEntries = await module_1.JournalEntryModel.find({
                tripId: trip._id,
                status: "POSTED",
            }).lean();
            let accountingRecognizedRevenueEgp = 0;
            let accountingRecognizedExpenseEgp = 0;
            for (const je of journalEntries) {
                for (const line of je.lines) {
                    if (line.accountCode.startsWith("4")) {
                        accountingRecognizedRevenueEgp = utils_1.Money.add(accountingRecognizedRevenueEgp, utils_1.Money.subtract(line.credit, line.debit));
                    }
                    else if (line.accountCode.startsWith("5")) {
                        accountingRecognizedExpenseEgp = utils_1.Money.add(accountingRecognizedExpenseEgp, utils_1.Money.subtract(line.debit, line.credit));
                    }
                }
            }
            const accountingProfitEgp = utils_1.Money.subtract(accountingRecognizedRevenueEgp, accountingRecognizedExpenseEgp);
            results.push({
                tripId: trip._id,
                tripCode: trip.code,
                tripNameAr: trip.nameAr,
                season: trip.season,
                capacity: trip.capacity,
                confirmedSoldSeats: trip.confirmedSoldSeats,
                occupancyRatePercent: trip.capacity > 0 ? utils_1.Money.round((trip.confirmedSoldSeats / trip.capacity) * 100) : 0,
                forecast: {
                    revenueEgp: forecastRevenueEgp,
                    costEgp: forecastCostEgp,
                    profitEgp: forecastProfitEgp,
                },
                operationalActual: {
                    bookingsCount: bookingAgg?.bookingsCount || 0,
                    revenueEgp: operationalRevenueEgp,
                    costEgp: operationalCostEgp,
                    profitEgp: operationalActualProfitEgp,
                    collectedCashEgp: utils_1.Money.round(bookingAgg?.collectedCashEgp || 0),
                    outstandingReceivablesEgp: utils_1.Money.round(bookingAgg?.outstandingReceivablesEgp || 0),
                },
                accountingRecognized: {
                    recognizedRevenueEgp: accountingRecognizedRevenueEgp,
                    recognizedExpenseEgp: accountingRecognizedExpenseEgp,
                    accountingProfitEgp,
                },
            });
        }
        return results;
    }
    async getBranchPerformanceReport(req) {
        const matchStage = {
            status: { $nin: ["CANCELLED", "REFUNDED"] },
        };
        Object.assign(matchStage, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, req.query.branchId, "branchId"));
        const pipeline = await module_1.BookingModel.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$branchId",
                    totalBookings: { $sum: 1 },
                    confirmedBookings: {
                        $sum: { $cond: [{ $in: ["$status", ["CONFIRMED", "COMPLETED"]] }, 1, 0] },
                    },
                    totalNetSalesEgp: { $sum: "$netSellingPrice" },
                    totalGrossCollectedEgp: { $sum: "$amountPaid" },
                    totalRefundedEgp: { $sum: { $ifNull: ["$refundedAmount", 0] } },
                    totalRemainingBalanceEgp: { $sum: "$remainingBalance" },
                    totalEstimatedCostEgp: { $sum: "$priceSnapshot.costPerPassengerEgp" },
                },
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "_id",
                    foreignField: "_id",
                    as: "branch",
                },
            },
            { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
        ]);
        return pipeline.map((row) => {
            const sales = utils_1.Money.round(row.totalNetSalesEgp || 0);
            const grossCollected = utils_1.Money.round(row.totalGrossCollectedEgp || 0);
            const refunded = utils_1.Money.round(row.totalRefundedEgp || 0);
            const netCollected = utils_1.Money.subtract(grossCollected, refunded);
            const cost = utils_1.Money.round(row.totalEstimatedCostEgp || 0);
            return {
                branchId: row._id,
                branchCode: row.branch?.code || "HQ-DEFAULT",
                branchNameAr: row.branch?.nameAr || "الفرع الرئيسي",
                totalBookings: row.totalBookings,
                confirmedBookings: row.confirmedBookings,
                totalNetSalesEgp: sales,
                totalGrossCollectedEgp: grossCollected,
                totalRefundedEgp: refunded,
                totalCollectedEgp: netCollected,
                totalRemainingBalanceEgp: utils_1.Money.round(row.totalRemainingBalanceEgp || 0),
                operationalProfitEgp: utils_1.Money.subtract(sales, cost),
                collectionEfficiencyPercent: sales > 0 ? utils_1.Money.round((netCollected / sales) * 100) : 0,
            };
        });
    }
    async getExecutiveSummary(req) {
        const branchScope = (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, req.query.branchId, "branchId");
        const [cashboxes, suppliers, expensesAgg, wholesaleAgg, customerBalancesAgg] = await Promise.all([
            module_1.CashboxModel.find(branchScope).populate("branchId", "code nameAr").lean(),
            req.branchContext?.isCentralAdmin ? module_1.SupplierModel.find({ status: "ACTIVE" }).lean() : Promise.resolve([]),
            module_1.ExpenseModel.aggregate([
                { $match: { ...branchScope, status: "POSTED" } },
                { $group: { _id: "$category", totalAmountEgp: { $sum: "$amountInEgp" }, count: { $sum: 1 } } },
            ]),
            module_1.WholesaleContractModel.aggregate([
                { $match: { ...branchScope, status: { $in: ["ACTIVE", "PARTIALLY_RELEASED"] } } },
                {
                    $group: {
                        _id: null,
                        contractsCount: { $sum: 1 },
                        totalSeats: { $sum: { $subtract: ["$seatQuantity", { $ifNull: ["$releasedSeats", 0] }] } },
                        totalContractValueEgp: { $sum: "$totalContractPriceEgp" },
                        totalPaidEgp: { $sum: "$paidAmountEgp" },
                        totalRemainingEgp: { $sum: "$remainingBalanceEgp" },
                    },
                },
            ]),
            module_1.BookingModel.aggregate([
                { $match: { ...branchScope, status: { $nin: ["CANCELLED", "REFUNDED"] }, remainingBalance: { $gt: 0 } } },
                {
                    $group: {
                        _id: null,
                        bookingsWithBalanceCount: { $sum: 1 },
                        totalSalesEgp: { $sum: "$netSellingPrice" },
                        totalGrossPaidEgp: { $sum: "$amountPaid" },
                        totalRefundedEgp: { $sum: { $ifNull: ["$refundedAmount", 0] } },
                        totalCustomerReceivablesEgp: { $sum: "$remainingBalance" },
                    },
                },
            ]),
        ]);
        return {
            cashboxes,
            supplierLiabilities: suppliers.map((s) => ({
                supplierId: s._id,
                code: s.code,
                nameAr: s.nameAr,
                type: s.type,
                currency: s.currency,
                currentBalance: s.currentBalance,
            })),
            expensesByCategory: expensesAgg,
            wholesalePerformance: wholesaleAgg[0] || {
                contractsCount: 0,
                totalSeats: 0,
                totalContractValueEgp: 0,
                totalPaidEgp: 0,
                totalRemainingEgp: 0,
            },
            customerBalances: customerBalancesAgg[0] || {
                bookingsWithBalanceCount: 0,
                totalCustomerReceivablesEgp: 0,
            },
        };
    }
}
exports.ReportService = ReportService;
exports.reportService = new ReportService();
