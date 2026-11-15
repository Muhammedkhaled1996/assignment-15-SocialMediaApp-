"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationJobService = exports.NotificationJobService = void 0;
const module_1 = require("../../DB/module");
const service_1 = require("../../common/service");
const quotas_1 = require("../quotas");
class NotificationJobService {
    async runScheduledOperationalJobs() {
        const now = new Date();
        const todayKey = now.toISOString().slice(0, 10);
        const expiredReservations = await module_1.InventoryReservationModel.find({
            status: "ACTIVE_HOLD",
            expiresAt: { $lte: now },
        }).lean();
        let expiredHoldsReleased = 0;
        for (const res of expiredReservations) {
            await quotas_1.quotaService.releaseReservation({
                reservationId: res._id,
                reason: "EXPIRED",
            });
            expiredHoldsReleased++;
            if (res.bookingId) {
                await module_1.BookingModel.updateOne({ _id: res.bookingId, status: "ON_HOLD" }, {
                    $set: { status: "CANCELLED", cancellationReason: "Hold expired automatically" },
                });
            }
            await this.upsertNotification({
                deduplicationKey: `HOLD_EXP:${res._id.toString()}`,
                type: "BOOKING_HOLD_EXPIRATION",
                titleAr: "انتهاء مهلة حجز مؤقت",
                titleEn: "Booking Hold Expired",
                messageAr: `تم تحرير ${res.quantity} مقعد تلقائياً لانتهاء مهلة الحجز المؤقت (${res.bookingReference || res._id})`,
                messageEn: `Automatically released ${res.quantity} seat(s) for expired hold (${res.bookingReference || res._id})`,
                branchId: res.branchId,
                entityType: "InventoryReservation",
                entityId: res._id.toString(),
            });
        }
        const overdueObligations = await module_1.SupplierLedgerEntryModel.find({
            entryType: "CONTRACT_OBLIGATION",
            isPaid: false,
            dueDate: { $lt: now },
        }).lean();
        for (const ob of overdueObligations) {
            await this.upsertNotification({
                deduplicationKey: `OVERDUE_SUP:${ob._id.toString()}:${todayKey}`,
                type: "OVERDUE_SUPPLIER_PAYMENT",
                titleAr: "دفعة مورد متأخرة السداد",
                titleEn: "Overdue Supplier Payment",
                messageAr: `الالتزام المالي رقم ${ob.referenceNumber || ob._id} بمبلغ ${ob.creditAmount} ${ob.currency} تجاوز تاريخ الاستحقاق`,
                messageEn: `Supplier obligation ${ob.referenceNumber || ob._id} (${ob.creditAmount} ${ob.currency}) is past due`,
                entityType: "SupplierLedgerEntry",
                entityId: ob._id.toString(),
            });
        }
        const openTrips = await module_1.TripModel.find({ status: "OPEN_FOR_BOOKING" }).lean();
        for (const trip of openTrips) {
            const threshold = Math.max(2, Math.floor(trip.capacity * 0.1));
            if (trip.availableInventory <= threshold) {
                await this.upsertNotification({
                    deduplicationKey: `LOW_INV:${trip._id.toString()}:${todayKey}`,
                    type: "LOW_TRIP_INVENTORY",
                    titleAr: "انخفاض المخزون المتاح للرحلة",
                    titleEn: "Low Trip Seat Inventory",
                    messageAr: `الرحلة ${trip.code} (${trip.nameAr}) متبقي بها ${trip.availableInventory} مقاعد فقط`,
                    messageEn: `Trip ${trip.code} has only ${trip.availableInventory} available seats remaining`,
                    entityType: "Trip",
                    entityId: trip._id.toString(),
                });
            }
        }
        await service_1.telegramService.sendPeriodicSummaryIfDue().catch(() => { });
        return {
            executedAt: now,
            expiredHoldsReleased,
            overdueSupplierObligationsDetected: overdueObligations.length,
        };
    }
    async upsertNotification(data) {
        const result = await module_1.NotificationModel.updateOne({ deduplicationKey: data.deduplicationKey }, {
            $setOnInsert: {
                ...data,
                isRead: false,
            },
        }, { upsert: true });
        if (result.upsertedCount && result.upsertedCount > 0) {
            await service_1.telegramService
                .notifyAdmins(`🚨 <b>${data.titleAr}</b>\n${data.messageAr}`)
                .catch(() => { });
        }
    }
}
exports.NotificationJobService = NotificationJobService;
exports.notificationJobService = new NotificationJobService();
