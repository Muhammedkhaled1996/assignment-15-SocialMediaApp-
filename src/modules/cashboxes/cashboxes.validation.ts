import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createCashboxValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().min(2),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      branchId: generalValidationFields.id(lang).optional(),
      isMainCashbox: z.boolean().default(false),
      currency: z.enum(["EGP", "SAR", "USD"]).default("EGP"),
      openingBalance: z.number().min(0).default(0),
      exchangeRateToEgp: z.number().positive().default(1),
    }),
  });
