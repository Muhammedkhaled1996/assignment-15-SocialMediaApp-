import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const loginSchema = (lang: LanguageEnum) => {
  return z.strictObject({
    email: generalValidationFields.email(lang),
    password: generalValidationFields.password(lang),
  });
};

export const login = (lang: LanguageEnum) => {
  return z.object({
    body: loginSchema(lang),
    query: z.strictObject({
      lang: z.enum(["ar", "en"]).default("ar"),
    }),
  });
};

export const logoutSchema = (lang: LanguageEnum) => {
  return z.object({
    body: z.strictObject({
      action: generalValidationFields.action(lang),
    }),
  });
};

export const changePassword = (lang: LanguageEnum) => {
  return z.object({
    body: z
      .strictObject({
        currentPassword: z.string().min(1),
        newPassword: generalValidationFields.password(lang),
        confirmPassword: generalValidationFields.confirmPassword(lang),
      })
      .superRefine((data, ctx) => {
        generalValidationFields.matchFields({ original: "newPassword", copy: "confirmPassword", data, ctx, lang });
      }),
  });
};

export const refreshTokenSchema = (_lang: LanguageEnum) => {
  return z.object({
    body: z
      .object({
        refreshToken: z.string().optional(),
        refresh_token: z.string().optional(),
      })
      .optional(),
  });
};
