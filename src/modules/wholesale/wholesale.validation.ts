import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createPartnerValidator = (_lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().min(2),
      companyNameAr: z.string().min(2),
      companyNameEn: z.string().min(2),
      tourismLicenseNumber: z.string().optional(),
      taxNumber: z.string().optional(),
      contactPerson: z.string().min(2),
      phone: z.string().min(6),
      email: z.string().email().optional(),
      address: z.string().optional(),
    }),
  });

export const createContractValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      contractNumber: z.string().optional(),
      partnerId: generalValidationFields.id(lang),
      tripId: generalValidationFields.id(lang),
      branchId: generalValidationFields.id(lang).optional(),
      allocationType: z.enum(["SEAT_BLOCK", "ENTIRE_TRIP"]).default("SEAT_BLOCK"),
      seatQuantity: z.number().int().min(1).optional(),
      unitPriceEgp: z.number().min(0),
      depositAmountEgp: z.number().min(0).default(0),
      paymentSchedule: z
        .array(
          z.object({
            dueDate: z.string(),
            amount: z.number().min(0),
          }),
        )
        .optional(),
      notes: z.string().optional(),
    }),
  });
