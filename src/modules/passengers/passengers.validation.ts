import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createPassengerValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      branchId: generalValidationFields.id(lang).optional(),
      arabicName: z.string().min(4),
      englishName: z.string().min(4),
      nationalId: z.string().length(14),
      gender: z.enum(["MALE", "FEMALE"]).optional(),
      nationality: z.string().default("EG"),
      occupation: z.string().optional(),
      governorate: z.string().optional(),
      phone: z.string().min(8),
      passportNumber: z.string().min(5).optional(),
      passportIssueDate: z.string().optional(),
      passportExpirationDate: z.string().optional(),
      passportAttachments: z.array(z.string()).default([]),
      emergencyContact: z
        .object({
          name: z.string(),
          relation: z.string(),
          phone: z.string(),
        })
        .optional(),
      mahramPassengerId: generalValidationFields.id(lang).nullable().optional(),
      mahramRelationship: z.string().optional(),
      familyGroupCode: z.string().optional(),
      ocrRawDraft: z.record(z.string(), z.any()).optional(),
    }),
  });
