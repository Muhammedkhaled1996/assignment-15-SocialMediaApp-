import { NODE_ENV } from "../../config";
import {
  BookingModel,
  BranchQuotaModel,
  CashboxModel,
  ExpenseModel,
  FinancialTransactionModel,
  NotificationModel,
  SupplierModel,
  SystemSettingModel,
  TripModel,
  WholesaleContractModel,
} from "../../DB/module";
import { Money } from "../utils";

export const TELEGRAM_EXECUTIVE_KEYBOARD = {
  keyboard: [
    [{ text: "📊 الملخص التنفيذي" }, { text: "💰 أرصدة الخزائن" }],
    [{ text: "✈️ حالة الرحلات والمقاعد" }, { text: "🏢 أداء الفروع" }],
    [{ text: "📈 أرباح الرحلات" }, { text: "🔔 آخر التنبيهات" }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMoney(amount: number, currency = "EGP"): string {
  const num = Number(amount || 0);
  return `${num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

export class TelegramService {
  private lastUpdateId = 0;
  private isPolling = false;
  private lastPeriodicSummaryAt = 0;

  private dynamicBotToken = "";
  private dynamicAdminChatIds: string[] = [];
  private dynamicSummaryIntervalMinutes = 720;

  private parseChatIds(raw: unknown): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((id) => String(id).trim()).filter(Boolean);
    }
    return String(raw)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  /**
   * Ensures the 3 Telegram settings exist in `SystemSettingModel` (category: "TELEGRAM")
   * and loads their current values into memory. Called on startup and whenever settings are updated via API.
   */
  async ensureDefaultSettingsAndLoad(): Promise<void> {
    try {
      const defaults = [
        {
          key: "TELEGRAM_BOT_TOKEN",
          value: "",
          category: "TELEGRAM",
          description: "رمز بوت التليجرام الخاص بالشركة (يتم الحصول عليه من @BotFather)",
        },
        {
          key: "TELEGRAM_ADMIN_CHAT_ID",
          value: [],
          category: "TELEGRAM",
          description: "قائمة معرفات حسابات التليجرام (Chat IDs) للمدير العام والشركاء المصرح لهم باستلام التقارير والتنبيهات",
        },
        {
          key: "TELEGRAM_SUMMARY_INTERVAL_MINUTES",
          value: 720,
          category: "TELEGRAM",
          description: "المدة الزمنية بالدقائق لإرسال الملخص التنفيذي الدوري تلقائياً على التليجرام (مثلاً 720 = كل 12 ساعة، 0 = إيقاف الإرسال الدوري)",
        },
      ];

      for (const item of defaults) {
        await SystemSettingModel.updateOne(
          { key: item.key },
          {
            $setOnInsert: {
              key: item.key,
              value: item.value,
              category: item.category,
              description: item.description,
            },
          },
          { upsert: true },
        );
      }

      await this.reloadConfigFromDB();
    } catch {
      // Ignore if DB is not connected yet
    }
  }

  /**
   * Reloads Telegram settings from `SystemSettingModel` in MongoDB without restarting the server.
   */
  async reloadConfigFromDB(): Promise<void> {
    try {
      const settings = await SystemSettingModel.find({
        key: {
          $in: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID", "TELEGRAM_SUMMARY_INTERVAL_MINUTES"],
        },
      }).lean();

      for (const s of settings) {
        if (s.key === "TELEGRAM_BOT_TOKEN") {
          this.dynamicBotToken = String(s.value ?? "").trim();
        } else if (s.key === "TELEGRAM_ADMIN_CHAT_ID") {
          this.dynamicAdminChatIds = this.parseChatIds(s.value);
        } else if (s.key === "TELEGRAM_SUMMARY_INTERVAL_MINUTES") {
          const num = Number(s.value);
          if (!Number.isNaN(num) && num >= 0) {
            this.dynamicSummaryIntervalMinutes = num;
          }
        }
      }

      if (this.isEnabled() && !this.isPolling && NODE_ENV !== "test") {
        this.startPolling();
      }
    } catch {
      // Ignore DB read errors
    }
  }

  getBotToken(): string {
    return this.dynamicBotToken.trim();
  }

  isEnabled(): boolean {
    return Boolean(this.getBotToken().length > 0);
  }

  getAdminChatIds(): string[] {
    return this.dynamicAdminChatIds;
  }

  getSummaryIntervalMinutes(): number {
    return this.dynamicSummaryIntervalMinutes;
  }

  isAuthorizedChat(chatId: string | number): boolean {
    const allowed = this.getAdminChatIds();
    return allowed.includes(String(chatId));
  }

  /**
   * Sends a message to a specific Telegram chat ID.
   * Non-throwing so network glitches never interrupt ERP database transactions.
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    includeMenuKeyboard = true,
  ): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const url = `https://api.telegram.org/bot${this.getBotToken()}/sendMessage`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          ...(includeMenuKeyboard ? { reply_markup: TELEGRAM_EXECUTIVE_KEYBOARD } : {}),
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Broadcasts an instant notification or report to all configured Admin Chat IDs.
   */
  async notifyAdmins(text: string): Promise<void> {
    const chatIds = this.getAdminChatIds();
    if (!this.isEnabled() || chatIds.length === 0) return;

    await Promise.allSettled(chatIds.map((chatId) => this.sendMessage(chatId, text, true)));
  }

  /**
   * Sends the periodic executive summary if the configured interval has elapsed.
   */
  async sendPeriodicSummaryIfDue(): Promise<boolean> {
    if (!this.isEnabled() || this.getAdminChatIds().length === 0) return false;
    const intervalMinutes = this.getSummaryIntervalMinutes();
    if (intervalMinutes <= 0) return false;

    const nowMs = Date.now();
    const intervalMs = intervalMinutes * 60 * 1000;

    if (this.lastPeriodicSummaryAt === 0) {
      this.lastPeriodicSummaryAt = nowMs;
      return false;
    }

    if (nowMs - this.lastPeriodicSummaryAt < intervalMs) {
      return false;
    }

    this.lastPeriodicSummaryAt = nowMs;
    const summaryText = await this.buildExecutiveSummaryText("⏰ <b>التقرير الدوري التلقائي للمدير العام</b>");
    await this.notifyAdmins(summaryText);
    return true;
  }

  /**
   * Starts background long-polling to respond to interactive commands & buttons from the General Manager.
   */
  startPolling(): void {
    if (!this.isEnabled() || this.isPolling || NODE_ENV === "test") return;
    this.isPolling = true;

    const poll = async () => {
      if (!this.isPolling || !this.isEnabled()) {
        this.isPolling = false;
        return;
      }
      try {
        const url = `https://api.telegram.org/bot${this.getBotToken()}/getUpdates?offset=${
          this.lastUpdateId + 1
        }&timeout=20`;
        const response = await fetch(url);
        if (response.ok) {
          const payload = (await response.json()) as {
            ok: boolean;
            result?: Array<{
              update_id: number;
              message?: {
                chat?: { id: number; first_name?: string };
                text?: string;
              };
            }>;
          };

          if (payload.ok && Array.isArray(payload.result)) {
            for (const update of payload.result) {
              this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);
              if (update.message?.chat?.id && update.message?.text) {
                await this.handleIncomingMessage(
                  update.message.chat.id,
                  update.message.text.trim(),
                  update.message.chat.first_name,
                );
              }
            }
          }
        }
      } catch {
        // Ignore transient network errors and retry after delay
      } finally {
        if (this.isPolling) {
          const timer = setTimeout(poll, 3000);
          timer.unref();
        }
      }
    };

    poll().catch(() => {});
  }

  /**
   * Processes incoming command or button press from Telegram chat.
   */
  async handleIncomingMessage(chatId: string | number, text: string, firstName?: string): Promise<string> {
    await this.reloadConfigFromDB();

    if (!this.isAuthorizedChat(chatId)) {
      const reply = [
        `🔒 <b>تنبيه أمان — نظام تروزيانا ERP</b>`,
        `مرحباً ${escapeHtml(firstName || "")}، هذا البوت مخصص للإدارة العليا فقط.`,
        ``,
        `معرف المحادثة الخاص بك (Chat ID) هو:`,
        `<code>${chatId}</code>`,
        ``,
        `لتفعيل صلاحيتك فوراً (بدون ريستارت للسيرفر)، قم بإضافة هذا الرقم من شاشة الإعدادات عبر المسار:`,
        `<code>PUT /api/v1/settings/TELEGRAM_ADMIN_CHAT_ID</code>`,
        `وأرسل في الـ Body:`,
        `<code>{ "action": "ADD", "value": "${chatId}" }</code>`,
      ].join("\n");
      await this.sendMessage(chatId, reply, false);
      return reply;
    }

    let responseText: string;

    switch (text) {
      case "/start":
      case "/menu":
        responseText = [
          `👋 <b>أهلاً بك في المساعد التنفيذي لنظام تروزيانا (Troziana ERP)</b>`,
          ``,
          `يمكنك طلب أي تقرير لحظي في أي وقت بالضغط على الأزرار بالأسفل أو عبر الأوامر التالية:`,
          `• 📊 <b>الملخص التنفيذي</b> (/summary)`,
          `• 💰 <b>أرصدة الخزائن</b> (/cashboxes)`,
          `• ✈️ <b>حالة الرحلات والمقاعد</b> (/trips)`,
          `• 🏢 <b>أداء الفروع</b> (/branches)`,
          `• 📈 <b>أرباح الرحلات</b> (/profit)`,
          `• 🔔 <b>آخر التنبيهات</b> (/alerts)`,
        ].join("\n");
        break;

      case "/id":
        responseText = `🆔 معرف المحادثة الخاص بك هو: <code>${chatId}</code>`;
        break;

      case "/summary":
      case "📊 الملخص التنفيذي":
        responseText = await this.buildExecutiveSummaryText("📊 <b>الملخص التنفيذي اللحظي — تروزيانا</b>");
        break;

      case "/cashboxes":
      case "💰 أرصدة الخزائن":
        responseText = await this.buildCashboxesReportText();
        break;

      case "/trips":
      case "✈️ حالة الرحلات والمقاعد":
        responseText = await this.buildTripsStatusReportText();
        break;

      case "/branches":
      case "🏢 أداء الفروع":
        responseText = await this.buildBranchesPerformanceText();
        break;

      case "/profit":
      case "📈 أرباح الرحلات":
        responseText = await this.buildTripProfitabilityText();
        break;

      case "/alerts":
      case "🔔 آخر التنبيهات":
        responseText = await this.buildLatestAlertsText();
        break;

      default:
        responseText = [
          `🤖 اختر التقرير المطلوب من أزرار القائمة بالأسفل:`,
          `• 📊 الملخص التنفيذي (/summary)`,
          `• 💰 أرصدة الخزائن (/cashboxes)`,
          `• ✈️ حالة الرحلات والمقاعد (/trips)`,
          `• 🏢 أداء الفروع (/branches)`,
          `• 📈 أرباح الرحلات (/profit)`,
          `• 🔔 آخر التنبيهات (/alerts)`,
        ].join("\n");
        break;
    }

    await this.sendMessage(chatId, responseText, true);
    return responseText;
  }

  /**
   * 1. Executive Summary Report Builder (with concise supporting breakdown for every figure)
   */
  async buildExecutiveSummaryText(headerTitle = "📊 <b>الملخص التنفيذي العام</b>"): Promise<string> {
    const [
      cashboxes,
      suppliers,
      expensesByCat,
      wholesaleContracts,
      bookingsWithBalance,
      activeTripsCount,
    ] = await Promise.all([
      CashboxModel.find().populate("branchId", "code nameAr").lean(),
      SupplierModel.find({ status: "ACTIVE" }).lean(),
      ExpenseModel.aggregate([
        { $match: { status: "POSTED" } },
        { $group: { _id: "$category", totalAmountEgp: { $sum: "$amountInEgp" }, count: { $sum: 1 } } },
      ]),
      WholesaleContractModel.find({ status: { $in: ["ACTIVE", "PARTIALLY_RELEASED"] } })
        .populate("partnerId", "nameAr code")
        .lean(),
      BookingModel.find({ status: { $nin: ["CANCELLED", "REFUNDED"] }, remainingBalance: { $gt: 0 } })
        .select("bookingNumber netSellingPrice amountPaid refundedAmount remainingBalance")
        .lean(),
      TripModel.countDocuments({ status: "OPEN_FOR_BOOKING" }),
    ]);

    const totalCashboxesEgp = cashboxes
      .filter((c) => c.currency === "EGP")
      .reduce((acc, c) => Money.add(acc, c.currentBalance), 0);

    const totalCustomerSales = bookingsWithBalance.reduce((acc, b) => Money.add(acc, b.netSellingPrice), 0);
    const totalCustomerGrossPaid = bookingsWithBalance.reduce((acc, b) => Money.add(acc, b.amountPaid), 0);
    const totalCustomerRefunded = bookingsWithBalance.reduce((acc, b) => Money.add(acc, b.refundedAmount || 0), 0);
    const totalCustomerNetPaid = Money.subtract(totalCustomerGrossPaid, totalCustomerRefunded);
    const totalCustomerReceivables = bookingsWithBalance.reduce((acc, b) => Money.add(acc, b.remainingBalance), 0);

    const wholesaleSeats = wholesaleContracts.reduce(
      (acc, w) => acc + Math.max(0, (w.seatQuantity || 0) - (w.releasedSeats || 0)),
      0,
    );
    const wholesaleTotalValue = wholesaleContracts.reduce((acc, w) => Money.add(acc, w.totalContractPriceEgp || 0), 0);
    const wholesalePaid = wholesaleContracts.reduce((acc, w) => Money.add(acc, w.paidAmountEgp || 0), 0);
    const wholesaleRemaining = wholesaleContracts.reduce((acc, w) => Money.add(acc, w.remainingBalanceEgp || 0), 0);

    const totalExpensesEgp = expensesByCat.reduce((acc, e) => Money.add(acc, e.totalAmountEgp || 0), 0);
    const suppliersWithBalance = suppliers.filter((s) => s.currentBalance > 0);

    const lines: string[] = [
      headerTitle,
      `🕒 التاريخ: ${new Date().toLocaleString("ar-EG")}`,
      `────────────────────`,
      `💰 <b>إجمالي النقدية بالخزائن (EGP): ${formatMoney(totalCashboxesEgp, "EGP")}</b> (${cashboxes.length} خزينة)`,
    ];

    for (const cb of cashboxes) {
      lines.push(
        `   ↳ ${escapeHtml(cb.nameAr)}: <b>${formatMoney(cb.currentBalance, cb.currency)}</b> (افتتاحي ${formatMoney(cb.openingBalance, "")} + مقبوضات ${formatMoney(cb.totalInflows, "")} - مدفوعات ${formatMoney(cb.totalOutflows, "")})`,
      );
    }

    lines.push(
      ``,
      `👥 <b>مديونيات العملاء المتبقية (أفراد): ${formatMoney(totalCustomerReceivables, "EGP")}</b> (${bookingsWithBalance.length} حجز)`,
    );
    if (bookingsWithBalance.length > 0) {
      const refundNote = totalCustomerRefunded > 0 ? ` [مقبوض ${formatMoney(totalCustomerGrossPaid, "")} - مسترد ${formatMoney(totalCustomerRefunded, "")}]` : "";
      lines.push(
        `   ↳ المؤيد: صافي المبيعات ${formatMoney(totalCustomerSales, "EGP")} - صافي المحصل ${formatMoney(totalCustomerNetPaid, "EGP")}${refundNote} = <b>${formatMoney(totalCustomerReceivables, "EGP")}</b>`,
      );
    }

    lines.push(
      ``,
      `🤝 <b>عقود الجملة النشطة (B2B): ${wholesaleContracts.length} عقد (${wholesaleSeats} مقعد فعلي)</b>`,
      `   ↳ المؤيد: إجمالي العقود ${formatMoney(wholesaleTotalValue, "EGP")} | المحصل ${formatMoney(wholesalePaid, "EGP")} | متبقي للتحصيل: <b>${formatMoney(wholesaleRemaining, "EGP")}</b>`,
    );

    lines.push(
      ``,
      `📉 <b>إجمالي المصروفات المسجلة: ${formatMoney(totalExpensesEgp, "EGP")}</b>`,
    );
    for (const exp of expensesByCat) {
      lines.push(`   ↳ بند ${escapeHtml(exp._id)}: ${formatMoney(exp.totalAmountEgp, "EGP")} (${exp.count} حركة)`);
    }

    lines.push(``, `✈️ <b>الرحلات المفتوحة للحجز حالياً:</b> ${activeTripsCount} رحلة`);

    if (suppliersWithBalance.length > 0) {
      lines.push(``, `🏨 <b>مستحقات الموردين القائمة (${suppliersWithBalance.length}):</b>`);
      for (const sup of suppliersWithBalance.slice(0, 6)) {
        lines.push(`   ↳ ${escapeHtml(sup.nameAr)}: <b>${formatMoney(sup.currentBalance, sup.currency)}</b>`);
      }
    } else {
      lines.push(``, `🏨 <b>مستحقات الموردين القائمة:</b> لا توجد مديونيات متأخرة`);
    }

    return lines.join("\n");
  }

  /**
   * 2. Cashboxes Report Builder (with Inflow/Outflow breakdown by transaction type)
   */
  async buildCashboxesReportText(): Promise<string> {
    const cashboxes = await CashboxModel.find().populate("branchId", "code nameAr").lean();
    if (cashboxes.length === 0) {
      return `💰 <b>أرصدة الخزائن</b>\nلا توجد خزائن مسجلة حتى الآن.`;
    }

    const txBreakdown = await FinancialTransactionModel.aggregate([
      {
        $group: {
          _id: { cashboxId: "$cashboxId", type: "$type" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const lines: string[] = [`💰 <b>تقرير أرصدة الخزائن اللحظي (${cashboxes.length})</b>`, `────────────────────`];
    for (const cb of cashboxes) {
      const branch = cb.branchId as any;
      const branchLabel = branch?.nameAr ? ` (${escapeHtml(branch.nameAr)})` : "";
      const lastClosed = cb.lastClosedAt ? new Date(cb.lastClosedAt).toLocaleDateString("ar-EG") : "لم تقفل بعد";

      const getTxSum = (type: string) => {
        const found = txBreakdown.find(
          (t) => String(t._id.cashboxId) === String(cb._id) && t._id.type === type,
        );
        return found ? Money.round(found.totalAmount) : 0;
      };

      const receiptsIn = getTxSum("RECEIPT");
      const transfersIn = getTxSum("TRANSFER_IN");
      const expensesOut = getTxSum("EXPENSE");
      const supplierPaymentsOut = getTxSum("SUPPLIER_PAYMENT");
      const refundsOut = getTxSum("REFUND");
      const transfersOut = getTxSum("TRANSFER_OUT");

      const inflowDetails: string[] = [];
      if (receiptsIn > 0) inflowDetails.push(`سندات قبض عملاء: ${formatMoney(receiptsIn, cb.currency)}`);
      if (transfersIn > 0) inflowDetails.push(`تحويلات واردة: ${formatMoney(transfersIn, cb.currency)}`);

      const outflowDetails: string[] = [];
      if (expensesOut > 0) outflowDetails.push(`مصروفات تشغيل: ${formatMoney(expensesOut, cb.currency)}`);
      if (supplierPaymentsOut > 0) outflowDetails.push(`دفعات موردين: ${formatMoney(supplierPaymentsOut, cb.currency)}`);
      if (refundsOut > 0) outflowDetails.push(`استردادات عملاء: ${formatMoney(refundsOut, cb.currency)}`);
      if (transfersOut > 0) outflowDetails.push(`تحويلات صادرة: ${formatMoney(transfersOut, cb.currency)}`);

      lines.push(
        `🔹 <b>${escapeHtml(cb.nameAr)}</b> [${escapeHtml(cb.code)}]${branchLabel}`,
        `   • الرصيد الافتتاحي: ${formatMoney(cb.openingBalance, cb.currency)}`,
        `   • إجمالي المقبوضات (+): <b>${formatMoney(cb.totalInflows, cb.currency)}</b>${inflowDetails.length ? `\n     ↳ (${inflowDetails.join(" + ")})` : ""}`,
        `   • إجمالي المدفوعات (-): <b>${formatMoney(cb.totalOutflows, cb.currency)}</b>${outflowDetails.length ? `\n     ↳ (${outflowDetails.join(" + ")})` : ""}`,
        `   • 💵 <b>الرصيد الحالي الفعلي: ${formatMoney(cb.currentBalance, cb.currency)}</b>`,
        `   • آخر تقفيل يومي: ${lastClosed}`,
        ``,
      );
    }
    return lines.join("\n").trim();
  }

  /**
   * 3. Trips & Seat Quota Status Report Builder (with complete 40-seat equation & room category prices)
   */
  async buildTripsStatusReportText(): Promise<string> {
    const trips = await TripModel.find({
      status: { $in: ["OPEN_FOR_BOOKING", "PUBLISHED", "DEPARTED", "DRAFT"] },
    })
      .populate("approvedPricingVersionId")
      .sort({ departureDate: 1 })
      .limit(12)
      .lean();

    if (trips.length === 0) {
      return `✈️ <b>حالة الرحلات والمقاعد</b>\nلا توجد رحلات نشطة حالياً.`;
    }

    const quotas = await BranchQuotaModel.find({ status: "ACTIVE" }).lean();

    const lines: string[] = [`✈️ <b>تقرير حالة الرحلات والمقاعد والأسعار (${trips.length})</b>`, `────────────────────`];
    for (const trip of trips) {
      const depDate = trip.departureDate ? new Date(trip.departureDate).toLocaleDateString("ar-EG") : "—";
      const pricing = trip.approvedPricingVersionId as any;
      const cats = pricing?.categories;

      const tripQuotas = quotas.filter((q) => String(q.tripId) === String(trip._id));
      const branchQuotaAvailable = tripQuotas.reduce((acc, q) => acc + (q.availableSeats || 0), 0);

      const totalAccountedSeats =
        (trip.confirmedSoldSeats || 0) +
        (trip.reservedSeats || 0) +
        (trip.allocatedToBranchesSeats || 0) +
        (trip.wholesaleAllocatedSeats || 0) +
        (trip.availableInventory || 0);

      const totalSellableAcrossCompany = (trip.availableInventory || 0) + branchQuotaAvailable;

      lines.push(
        `🕋 <b>${escapeHtml(trip.nameAr)}</b> [${escapeHtml(trip.code)}]`,
        `   • تاريخ السفر: ${depDate} | الحالة: ${escapeHtml(trip.status)}`,
        `   • <b>معادلة المقاعد (السعة الكلية: ${trip.capacity} مقعد):</b>`,
        `     - مباع ومؤكد (أفراد): <b>${trip.confirmedSoldSeats}</b> مقعد`,
        `     - حجز مؤقت (ON_HOLD): <b>${trip.reservedSeats}</b> مقعد`,
        `     - مباع عقود جملة (B2B): <b>${trip.wholesaleAllocatedSeats || 0}</b> مقعد`,
        `     - مخصص لحصص الفروع (Quotas): <b>${trip.allocatedToBranchesSeats || 0}</b> مقعد (متاح منها بالحصة: ${branchQuotaAvailable})`,
        `     - المتاح في الرصيد العام المشترك: <b>${trip.availableInventory}</b> مقعد`,
        `   • 🟢 <b>إجمالي المتاح للبيع الآن (عام + حصص فروع): ${totalSellableAcrossCompany} مقعد</b> (مجموع المعادلة: ${totalAccountedSeats}/${trip.capacity})`,
      );

      if (cats) {
        lines.push(
          `   • 🏷️ <b>أسعار البيع المعتمدة للفرد:</b>`,
          `     - رباعي (Quad): <b>${formatMoney(cats.QUAD?.sellingPriceEgp, "EGP")}</b> (حد أدنى: ${formatMoney(cats.QUAD?.minimumSellingPriceEgp, "EGP")})`,
          `     - ثلاثي (Triple): <b>${formatMoney(cats.TRIPLE?.sellingPriceEgp, "EGP")}</b> (حد أدنى: ${formatMoney(cats.TRIPLE?.minimumSellingPriceEgp, "EGP")})`,
          `     - ثنائي (Double): <b>${formatMoney(cats.DOUBLE?.sellingPriceEgp, "EGP")}</b> (حد أدنى: ${formatMoney(cats.DOUBLE?.minimumSellingPriceEgp, "EGP")})`,
        );
      }

      lines.push(``);
    }
    return lines.join("\n").trim();
  }

  /**
   * 4. Branches Performance Report Builder (showing Gross Collected, Refunds, Net Collected & Remaining)
   */
  async buildBranchesPerformanceText(): Promise<string> {
    const pipeline = await BookingModel.aggregate([
      { $match: { status: { $nin: ["CANCELLED", "REFUNDED"] } } },
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

    if (pipeline.length === 0) {
      return `🏢 <b>أداء الفروع والمبيعات</b>\nلا توجد حجوزات مسجلة للفروع حتى الآن.`;
    }

    const lines: string[] = [`🏢 <b>تقرير أداء ومبيعات الفروع</b>`, `────────────────────`];
    for (const row of pipeline) {
      const sales = Money.round(row.totalNetSalesEgp || 0);
      const grossCollected = Money.round(row.totalGrossCollectedEgp || 0);
      const refunded = Money.round(row.totalRefundedEgp || 0);
      const netCollected = Money.subtract(grossCollected, refunded);
      const remaining = Money.round(row.totalRemainingBalanceEgp || 0);
      const efficiency = sales > 0 ? Math.round((netCollected / sales) * 100) : 0;

      const branchName = row.branch?.nameAr || "الفرع الرئيسي - القاهرة";
      const branchCode = row.branch?.code || "HQ-CAI";

      lines.push(
        `🏛️ <b>${escapeHtml(branchName)}</b> [${escapeHtml(branchCode)}]`,
        `   • الحجوزات: ${row.totalBookings} (منها ${row.confirmedBookings} مؤكد)`,
        `   • صافي المبيعات: <b>${formatMoney(sales, "EGP")}</b>`,
        `   • إجمالي المقبوضات: ${formatMoney(grossCollected, "EGP")}${refunded > 0 ? ` | مردودات عملاء (Refunds): -${formatMoney(refunded, "EGP")}` : ""}`,
        `   • 💵 <b>صافي المحصل الفعلي: ${formatMoney(netCollected, "EGP")}</b> (كفاءة التحصيل: ${efficiency}%)`,
        `   • 📌 <b>المتبقي عند العملاء: ${formatMoney(remaining, "EGP")}</b> (${formatMoney(sales, "")} مبيعات - ${formatMoney(netCollected, "")} صافي محصل)`,
        ``,
      );
    }
    return lines.join("\n").trim();
  }

  /**
   * 5. Trip Profitability Report Builder (explaining Feasibility Study vs Retail + Wholesale Actuals)
   */
  async buildTripProfitabilityText(): Promise<string> {
    const trips = await TripModel.find().populate("approvedPricingVersionId").sort({ departureDate: -1 }).limit(10).lean();
    if (trips.length === 0) {
      return `📈 <b>أرباح الرحلات</b>\nلا توجد رحلات مسجلة حتى الآن.`;
    }

    const lines: string[] = [`📈 <b>تقرير ربحية الرحلات (دراسة الجدوى مقابل الفعلي)</b>`, `────────────────────`];
    for (const trip of trips) {
      const pricing = trip.approvedPricingVersionId as any;
      const forecastRevenue = pricing?.totals?.estimatedTotalGroupRevenueEgp || 0;
      const forecastCost = pricing?.totals?.estimatedTotalGroupCostEgp || 0;
      const forecastProfit = pricing?.totals?.expectedGroupProfitEgp || 0;
      const quadCostPerPax = pricing?.categories?.QUAD?.totalCostPerPassengerEgp || 0;
      const quadSellPerPax = pricing?.categories?.QUAD?.sellingPriceEgp || 0;
      const quadProfitPerPax = pricing?.categories?.QUAD?.profitPerPassengerEgp || 0;

      const [bookingAgg, wholesaleContracts] = await Promise.all([
        BookingModel.aggregate([
          {
            $match: {
              tripId: trip._id,
              status: { $in: ["CONFIRMED", "COMPLETED"] },
            },
          },
          {
            $group: {
              _id: "$tripId",
              revenueEgp: { $sum: "$netSellingPrice" },
              costEgp: { $sum: "$priceSnapshot.costPerPassengerEgp" },
              grossPaidEgp: { $sum: "$amountPaid" },
              refundedEgp: { $sum: { $ifNull: ["$refundedAmount", 0] } },
            },
          },
        ]),
        WholesaleContractModel.find({
          tripId: trip._id,
          status: { $in: ["ACTIVE", "PARTIALLY_RELEASED"] },
        }).lean(),
      ]);

      const retailRev = Money.round(bookingAgg[0]?.revenueEgp || 0);
      const retailCost = Money.round(bookingAgg[0]?.costEgp || 0);
      const retailProfit = Money.subtract(retailRev, retailCost);

      const wholesaleSeats = wholesaleContracts.reduce(
        (acc, w) => acc + Math.max(0, (w.seatQuantity || 0) - (w.releasedSeats || 0)),
        0,
      );
      const wholesaleRev = wholesaleContracts.reduce((acc, w) => Money.add(acc, w.totalContractPriceEgp || 0), 0);
      const wholesaleEstimatedCost = Money.multiply(quadCostPerPax, wholesaleSeats);
      const wholesaleProfit = Money.subtract(wholesaleRev, wholesaleEstimatedCost);

      const totalSoldSeats = (trip.confirmedSoldSeats || 0) + wholesaleSeats;
      const totalActualRev = Money.add(retailRev, wholesaleRev);
      const totalActualCost = Money.add(retailCost, wholesaleEstimatedCost);
      const totalActualProfit = Money.subtract(totalActualRev, totalActualCost);

      lines.push(
        `✈️ <b>${escapeHtml(trip.nameAr)}</b> [${escapeHtml(trip.code)}]`,
        `   • <b>1) المتوقع بدراسة الجدوى لكامل الرحلة (${trip.capacity} مقعد):</b>`,
        `     - أساس التسعير (غرفة رباعية): بيع ${formatMoney(quadSellPerPax, "")} - تكلفة ${formatMoney(quadCostPerPax, "")} = ربح <b>${formatMoney(quadProfitPerPax, "EGP")}</b> للفرد`,
        `     - إجمالي الإيراد المتوقع (${trip.capacity} مقعد): ${formatMoney(forecastRevenue, "EGP")}`,
        `     - إجمالي التكلفة المتوقعة (${trip.capacity} مقعد): ${formatMoney(forecastCost, "EGP")}`,
        `     - 🎯 <b>صافي الربح المتوقع بدراسة الجدوى: ${formatMoney(forecastProfit, "EGP")}</b> (${formatMoney(quadProfitPerPax, "")} × ${trip.capacity} مقعد)`,
        ``,
        `   • <b>2) الأداء الفعلي للمقاعد المباعة حتى الآن (${totalSoldSeats} من ${trip.capacity} مقعد):</b>`,
        `     - مبيعات الأفراد المؤكدة (${trip.confirmedSoldSeats} مقعد): إيراد ${formatMoney(retailRev, "")} - تكلفة ${formatMoney(retailCost, "")} = ربح <b>${formatMoney(retailProfit, "EGP")}</b>`,
      );

      if (wholesaleSeats > 0) {
        lines.push(
          `     - عقود الجملة B2B (${wholesaleSeats} مقعد): إيراد ${formatMoney(wholesaleRev, "")} - تكلفة ${formatMoney(wholesaleEstimatedCost, "")} = ربح <b>${formatMoney(wholesaleProfit, "EGP")}</b>`,
        );
      }

      lines.push(
        `     - 💰 <b>إجمالي صافي الربح الفعلي المحقق حتى الآن: ${formatMoney(totalActualProfit, "EGP")}</b>`,
        ``,
      );
    }
    return lines.join("\n").trim();
  }

  /**
   * 6. Latest Operational Alerts Builder
   */
  async buildLatestAlertsText(): Promise<string> {
    const alerts = await NotificationModel.find().sort({ createdAt: -1 }).limit(10).lean();
    if (alerts.length === 0) {
      return `🔔 <b>آخر التنبيهات الهامة</b>\n✅ لا توجد أي تنبيهات أو تحذيرات حالياً.`;
    }

    const lines: string[] = [`🔔 <b>آخر 10 تنبيهات تشغيلية ومالية</b>`, `────────────────────`];
    for (const alert of alerts) {
      const statusIcon = alert.isRead ? "☑️" : "🚨";
      lines.push(
        `${statusIcon} <b>${escapeHtml(alert.titleAr)}</b>`,
        `   ${escapeHtml(alert.messageAr)}`,
        ``,
      );
    }
    return lines.join("\n").trim();
  }
}

export const telegramService = new TelegramService();
