import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createBranchValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().min(2).max(15),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      governorate: z.string().min(2),
      city: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      managerId: generalValidationFields.id(lang).optional(),
      isHeadquarters: z.boolean().optional(),
      status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    }),
  });

export const updateBranchValidator = (lang: LanguageEnum) =>
  z.object({
    params: z.object({ id: generalValidationFields.id(lang) }),
    body: z.object({
      nameAr: z.string().min(2).optional(),
      nameEn: z.string().min(2).optional(),
      governorate: z.string().min(2).optional(),
      city: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      managerId: generalValidationFields.id(lang).optional(),
      status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    }),
  });
