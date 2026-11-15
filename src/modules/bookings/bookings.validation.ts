import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createBookingValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      idempotencyKey: z.string().optional(),
      tripId: generalValidationFields.id(lang),
      groupId: generalValidationFields.id(lang).nullable().optional(),
      passengerId: generalValidationFields.id(lang),
      branchId: generalValidationFields.id(lang).optional(),
      pricingVersionId: generalValidationFields.id(lang).optional(),
      roomType: z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD"]),
      passengerCategory: z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"]).optional(),
      discountAmount: z.number().min(0).default(0),
      status: z.enum(["DRAFT", "ON_HOLD"]).default("ON_HOLD"),
      holdMinutes: z.number().int().min(1).optional(),
      mahramPassengerId: generalValidationFields.id(lang).nullable().optional(),
      familyGroupCode: z.string().optional(),
      notes: z.string().optional(),
    }),
  });
