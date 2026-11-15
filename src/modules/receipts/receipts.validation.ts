import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createReceiptValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      idempotencyKey: z.string().optional(),
      bookingId: generalValidationFields.id(lang).optional(),
      wholesaleContractId: generalValidationFields.id(lang).optional(),
      branchId: generalValidationFields.id(lang).optional(),
      cashboxId: generalValidationFields.id(lang),
      amount: z.number().positive(),
      exchangeRateToEgp: z.number().positive().default(1),
      paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "POS_CARD", "CHEQUE"]).default("CASH"),
      referenceCode: z.string().optional(),
      notes: z.string().optional(),
    }),
  });
