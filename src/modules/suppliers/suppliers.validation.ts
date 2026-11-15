import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createSupplierValidator = (_lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().min(2).max(20),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      type: z.enum(["AIRLINE", "BROKER", "HOTEL", "SAUDI_AGENT", "TRANSPORT", "OTHER"]),
      contactPerson: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      country: z.string().optional(),
      taxNumber: z.string().optional(),
      commercialRegister: z.string().optional(),
      bankDetails: z
        .object({
          bankName: z.string().optional(),
          accountName: z.string().optional(),
          accountNumber: z.string().optional(),
          iban: z.string().optional(),
          swiftCode: z.string().optional(),
        })
        .optional(),
      currency: z.enum(["EGP", "SAR", "USD", "EUR"]).default("SAR"),
      openingBalance: z.number().default(0),
      exchangeRateToEgp: z.number().positive().optional(),
      notes: z.string().optional(),
    }),
  });

export const recordLedgerAdjustmentValidator = (lang: LanguageEnum) =>
  z.object({
    params: z.object({ id: generalValidationFields.id(lang) }),
    body: z.object({
      entryType: z.enum(["DEPOSIT", "PARTIAL_PAYMENT", "FULL_PAYMENT", "CREDIT_NOTE", "ADJUSTMENT"]),
      description: z.string().min(3),
      debitAmount: z.number().min(0).default(0),
      creditAmount: z.number().min(0).default(0),
      exchangeRateToEgp: z.number().positive().default(1),
      referenceNumber: z.string().optional(),
      dueDate: z.string().optional(),
    }),
  });
