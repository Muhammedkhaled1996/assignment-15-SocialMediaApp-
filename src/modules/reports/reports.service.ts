import { Request } from "express";
import mongoose from "mongoose";
import {
  BookingModel,
  CashboxModel,
  ExpenseModel,
  JournalEntryModel,
  SupplierModel,
  TripModel,
  WholesaleContractModel,
} from "../../DB/module";
import { resolveScopedBranchFilter } from "../../middleware";
import { Money } from "../../common/utils";

export class ReportService {
  /**
   * 1. Trip Profitability Analytics
   */
  async getTripProfitabilityReport(query: { tripId?: string; season?: string }) {
    const tripFilter: Record<string, any> = {};
    if (query.tripId) tripFilter._id = new mongoose.Types.ObjectId(query.tripId);
    if (query.season) tripFilter.season = query.season;

    const trips = await TripModel.find(tripFilter).populate("approvedPricingVersionId").lean();
    const results = [];

    for (const trip of trips) {
      const pricing = trip.approvedPricingVersionId as any;
      const forecastRevenueEgp = pricing?.totals?.estimatedTotalGroupRevenueEgp || 0;
      const forecastCostEgp = pricing?.totals?.estimatedTotalGroupCostEgp || 0;
      const forecastProfitEgp = pricing?.totals?.expectedGroupProfitEgp || 0;

      const [bookingAgg] = await BookingModel.aggregate([
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

      const operationalRevenueEgp = Money.round(bookingAgg?.operationalRevenueEgp || 0);
      const operationalCostEgp = Money.round(bookingAgg?.snapshotCostEgp || 0);
      const operationalActualProfitEgp = Money.subtract(operationalRevenueEgp, operationalCostEgp);

      const journalEntries = await JournalEntryModel.find({
        tripId: trip._id,
        status: "POSTED",
      }).lean();

      let accountingRecognizedRevenueEgp = 0;
      let accountingRecognizedExpenseEgp = 0;
      for (const je of journalEntries) {
        for (const line of je.lines) {
          if (line.accountCode.startsWith("4")) {
            accountingRecognizedRevenueEgp = Money.add(
              accountingRecognizedRevenueEgp,
              Money.subtract(line.credit, line.debit),
            );
          } else if (line.accountCode.startsWith("5")) {
            accountingRecognizedExpenseEgp = Money.add(
              accountingRecognizedExpenseEgp,
              Money.subtract(line.debit, line.credit),
            );
          }
        }
      }
      const accountingProfitEgp = Money.subtract(accountingRecognizedRevenueEgp, accountingRecognizedExpenseEgp);

      results.push({
        tripId: trip._id,
        tripCode: trip.code,
        tripNameAr: trip.nameAr,
        season: trip.season,
        capacity: trip.capacity,
        confirmedSoldSeats: trip.confirmedSoldSeats,
        occupancyRatePercent: trip.capacity > 0 ? Money.round((trip.confirmedSoldSeats / trip.capacity) * 100) : 0,
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
          collectedCashEgp: Money.round(bookingAgg?.collectedCashEgp || 0),
          outstandingReceivablesEgp: Money.round(bookingAgg?.outstandingReceivablesEgp || 0),
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

  /**
   * 2. Branch Performance, Revenue, Bookings & Collection Efficiency Report
   */
  async getBranchPerformanceReport(req: Request) {
    const matchStage: Record<string, any> = {
      status: { $nin: ["CANCELLED", "REFUNDED"] },
    };
    Object.assign(
      matchStage,
      resolveScopedBranchFilter(req.branchContext, req.query.branchId as string, "branchId"),
    );

    const pipeline = await BookingModel.aggregate([
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
      const sales = Money.round(row.totalNetSalesEgp || 0);
      const grossCollected = Money.round(row.totalGrossCollectedEgp || 0);
      const refunded = Money.round(row.totalRefundedEgp || 0);
      const netCollected = Money.subtract(grossCollected, refunded);
      const cost = Money.round(row.totalEstimatedCostEgp || 0);
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
        totalRemainingBalanceEgp: Money.round(row.totalRemainingBalanceEgp || 0),
        operationalProfitEgp: Money.subtract(sales, cost),
        collectionEfficiencyPercent: sales > 0 ? Money.round((netCollected / sales) * 100) : 0,
      };
    });
  }

  /**
   * 3. Executive Dashboard Summary (Cashboxes, Suppliers, Customer Balances, Wholesale, Expenses)
   */
  async getExecutiveSummary(req: Request) {
    const branchScope = resolveScopedBranchFilter(req.branchContext, req.query.branchId as string, "branchId");

    const [cashboxes, suppliers, expensesAgg, wholesaleAgg, customerBalancesAgg] = await Promise.all([
      CashboxModel.find(branchScope).populate("branchId", "code nameAr").lean(),
      req.branchContext?.isCentralAdmin ? SupplierModel.find({ status: "ACTIVE" }).lean() : Promise.resolve([]),
      ExpenseModel.aggregate([
        { $match: { ...branchScope, status: "POSTED" } },
        { $group: { _id: "$category", totalAmountEgp: { $sum: "$amountInEgp" }, count: { $sum: 1 } } },
      ]),
      WholesaleContractModel.aggregate([
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
      BookingModel.aggregate([
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

export const reportService = new ReportService();
