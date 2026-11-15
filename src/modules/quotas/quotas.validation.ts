import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const allocateValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      tripId: generalValidationFields.id(lang),
      branchId: generalValidationFields.id(lang),
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
    }),
  });

export const transferValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      tripId: generalValidationFields.id(lang),
      fromBranchId: generalValidationFields.id(lang),
      toBranchId: generalValidationFields.id(lang),
      quantity: z.number().int().min(1),
      notes: z.string().optional(),
    }),
  });
