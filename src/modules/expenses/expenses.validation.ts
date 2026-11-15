import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createExpenseValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      voucherType: z.enum(["OPERATIONAL_EXPENSE", "SUPPLIER_PAYMENT"]).default("OPERATIONAL_EXPENSE"),
      branchId: generalValidationFields.id(lang).optional(),
      cashboxId: generalValidationFields.id(lang),
      tripId: generalValidationFields.id(lang).optional(),
      supplierId: generalValidationFields.id(lang).optional(),
      flightLotId: generalValidationFields.id(lang).optional(),
      hotelContractId: generalValidationFields.id(lang).optional(),
      category: z.string().min(2),
      amount: z.number().positive(),
      exchangeRateToEgp: z.number().positive().default(1),
      paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE"]).default("CASH"),
      description: z.string().min(3),
    }),
  });
