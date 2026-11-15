import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createTransferValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      fromCashboxId: generalValidationFields.id(lang),
      toCashboxId: generalValidationFields.id(lang),
      amount: z.number().positive(),
      exchangeRateToEgp: z.number().positive().default(1),
      notes: z.string().optional(),
    }),
  });
