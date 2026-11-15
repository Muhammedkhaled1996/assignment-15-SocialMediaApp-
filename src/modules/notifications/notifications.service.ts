import {
  BookingModel,
  InventoryReservationModel,
  NotificationModel,
  SupplierLedgerEntryModel,
  TripModel,
} from "../../DB/module";
import { telegramService } from "../../common/service";
import { quotaService } from "../quotas";

export class NotificationJobService {
  /**
   * Idempotent Operational Job Runner:
   * 1. Releases expired `ACTIVE_HOLD` seat reservations and transitions expired `ON_HOLD` bookings.
   * 2. Detects overdue and upcoming supplier payment obligations.
   * 3. Detects low trip seat inventory (< 10% remaining).
   * Uses `deduplicationKey` so running multiple times never creates duplicate notifications.
   */
  async runScheduledOperationalJobs() {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    const expiredReservations = await InventoryReservationModel.find({
      status: "ACTIVE_HOLD",
      expiresAt: { $lte: now },
    }).lean();

    let expiredHoldsReleased = 0;
    for (const res of expiredReservations) {
      await quotaService.releaseReservation({
        reservationId: res._id,
        reason: "EXPIRED",
      });
      expiredHoldsReleased++;

      if (res.bookingId) {
        await BookingModel.updateOne(
          { _id: res.bookingId, status: "ON_HOLD" },
          {
            $set: { status: "CANCELLED", cancellationReason: "Hold expired automatically" },
          },
        );
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

    const overdueObligations = await SupplierLedgerEntryModel.find({
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

    const openTrips = await TripModel.find({ status: "OPEN_FOR_BOOKING" }).lean();
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

    await telegramService.sendPeriodicSummaryIfDue().catch(() => {});

    return {
      executedAt: now,
      expiredHoldsReleased,
      overdueSupplierObligationsDetected: overdueObligations.length,
    };
  }

  async upsertNotification(data: {
    deduplicationKey: string;
    type: any;
    titleAr: string;
    titleEn: string;
    messageAr: string;
    messageEn: string;
    branchId?: any;
    recipientUserId?: any;
    entityType?: string;
    entityId?: string;
  }) {
    const result = await NotificationModel.updateOne(
      { deduplicationKey: data.deduplicationKey },
      {
        $setOnInsert: {
          ...data,
          isRead: false,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount && result.upsertedCount > 0) {
      await telegramService
        .notifyAdmins(`🚨 <b>${data.titleAr}</b>\n${data.messageAr}`)
        .catch(() => {});
    }
  }
}

export const notificationJobService = new NotificationJobService();
