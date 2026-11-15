import { Request } from "express";
import { CompanyModel, FileAttachmentModel, SystemSettingModel } from "../../DB/module";
import { auditService, telegramService } from "../../common/service";
import { resolveScopedBranchFilter } from "../../middleware";
import { FILE_STORAGE_PROVIDER } from "../../config";

export class SettingsService {
  async getCompanyProfile() {
    let company = await CompanyModel.findOne().lean();
    if (!company) {
      const created = await CompanyModel.create({
        code: "TRZ-CORP",
        nameAr: "شركة تروزيانا للسياحة",
        nameEn: "Troziana Travel Group",
        baseCurrency: "EGP",
        supportedTourismTypes: ["DOMESTIC", "RELIGIOUS", "OUTBOUND"],
        status: "ACTIVE",
      });
      company = created.toObject();
    }
    return company;
  }

  async updateCompanyProfile(payload: any, req: Request) {
    let company = await CompanyModel.findOne();
    if (!company) {
      company = await CompanyModel.create({
        code: payload.code || "TRZ-CORP",
        nameAr: payload.nameAr || "شركة تروزيانا للسياحة",
        nameEn: payload.nameEn || "Troziana Travel Group",
        baseCurrency: payload.baseCurrency || "EGP",
        status: "ACTIVE",
      });
    }

    const prev = company.toObject();
    const allowedFields = [
      "nameAr",
      "nameEn",
      "code",
      "logoUrl",
      "primaryColor",
      "secondaryColor",
      "website",
      "supportedTourismTypes",
      "taxNumber",
      "commercialRegister",
      "tourismLicenseNumber",
      "baseCurrency",
      "phone",
      "email",
      "address",
    ];
    for (const field of allowedFields) {
      if (payload[field] !== undefined) {
        (company as any)[field] = payload[field];
      }
    }
    company.updatedBy = req.user?._id;
    await company.save();

    await auditService.record({
      req,
      action: "COMPANY_PROFILE_UPDATED",
      module: "settings",
      entityType: "Company",
      entityId: company._id.toString(),
      previousValues: prev,
      newValues: company.toObject(),
    });

    return company;
  }

  async listSettings(query: any) {
    const filter: Record<string, any> = {};
    if (query.category) filter.category = String(query.category).toUpperCase().trim();
    return await SystemSettingModel.find(filter).sort({ key: 1 }).lean();
  }

  async upsertSetting(keyParam: string, body: any, req: Request) {
    const key = String(keyParam).toUpperCase().trim();
    let finalValue = body.value;
    let newlyAddedChatIds: string[] = [];

    if (key === "TELEGRAM_ADMIN_CHAT_ID") {
      const existing = await SystemSettingModel.findOne({ key }).lean();
      const currentList: string[] = Array.isArray(existing?.value)
        ? existing.value.map((x: any) => String(x).trim()).filter(Boolean)
        : String(existing?.value || "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

      const incomingList: string[] = Array.isArray(body.value)
        ? body.value.map((x: any) => String(x).trim()).filter(Boolean)
        : String(body.value ?? "")
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

      const action = String(body.action || body.mode || "SET").toUpperCase();
      if (action === "ADD") {
        newlyAddedChatIds = incomingList.filter((id) => !currentList.includes(id));
        finalValue = Array.from(new Set([...currentList, ...incomingList]));
      } else if (action === "REMOVE") {
        finalValue = currentList.filter((id) => !incomingList.includes(id));
      } else {
        newlyAddedChatIds = incomingList.filter((id) => !currentList.includes(id));
        finalValue = Array.from(new Set(incomingList));
      }
    } else if (key === "TELEGRAM_SUMMARY_INTERVAL_MINUTES") {
      finalValue = Math.max(0, Number(body.value || 0));
    }

    const defaultCategory = key.startsWith("TELEGRAM_") ? "TELEGRAM" : "GENERAL";

    const setting = await SystemSettingModel.findOneAndUpdate(
      { key },
      {
        $set: {
          value: finalValue,
          category: (body.category || defaultCategory).toUpperCase(),
          ...(body.description !== undefined ? { description: body.description } : {}),
          updatedBy: req.user?._id,
        },
      },
      { upsert: true, returnDocument: "after" },
    );

    if (key.startsWith("TELEGRAM_")) {
      await telegramService.reloadConfigFromDB();
      for (const chatId of newlyAddedChatIds) {
        telegramService
          .sendMessage(
            chatId,
            `✅ <b>تم تفعيل صلاحيتك في نظام تروزيانا ERP!</b>\nيمكنك الآن طلب أي تقرير لحظي من الأزرار بالأسفل وستصلك التنبيهات الهامة تلقائياً.`,
            true,
          )
          .catch(() => {});
      }
    }

    await auditService.record({
      req,
      action: "SYSTEM_SETTING_UPDATED",
      module: "settings",
      entityType: "SystemSetting",
      entityId: setting!._id.toString(),
      newValues: setting!.toObject(),
    });

    return setting;
  }

  async createAttachment(file: Express.Multer.File, req: Request) {
    return await FileAttachmentModel.create({
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: FILE_STORAGE_PROVIDER === "S3" ? "S3" : "LOCAL",
      storageKey: file.path,
      uploadedBy: req.user?._id,
      branchId: req.branchContext?.activeBranchId || null,
      relatedEntityType: req.body?.relatedEntityType,
      relatedEntityId: req.body?.relatedEntityId,
      isSensitive: req.body?.isSensitive !== "false",
    });
  }

  async listAttachments(req: Request) {
    const filter: Record<string, any> = {};
    if (!req.branchContext?.isCentralAdmin) {
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));
    }
    if (req.query.relatedEntityType) filter.relatedEntityType = req.query.relatedEntityType;
    if (req.query.relatedEntityId) filter.relatedEntityId = req.query.relatedEntityId;
    return await FileAttachmentModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  }
}

export const settingsService = new SettingsService();
