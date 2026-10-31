import { z } from "zod";
import { LanguageEnum, UserRole } from "../../common/enum";
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

export const signup = (lang: LanguageEnum) => {
  return z.object({
    body: loginSchema(lang)
      .safeExtend({
        userName: generalValidationFields.userName(lang),
        confirmPassword: generalValidationFields.confirmPassword(lang),
        phone: generalValidationFields.phone(lang),
        gender: generalValidationFields.gender(lang),
        role: z.enum(UserRole).optional(),
      })
      .superRefine((data, ctx) => {
        generalValidationFields.matchFields({ original: "password", copy: "confirmPassword", data, ctx, lang });

        if (!data.userName.includes(" ")) {
          ctx.addIssue({
            code: "custom",
            path: ["userName"],
            message: "userName must includes space between firstName and lastName",
          });
        }
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

//   .refine(
//     (data) => {
//       return data.password == data.confirmPassword;
//     },
//     { message: "password mismatch confirmPassword", path: ["confirmPassword"] },
//   );

export const confirmEmail = (lang: LanguageEnum) => {
  return z.object({
    body: z.strictObject({
      email: generalValidationFields.email(lang),
      otp: generalValidationFields.otp(lang),
    }),
  });
};

export const resendOtp = (lang: LanguageEnum) => {
  return z.object({
    body: z.strictObject({
      email: generalValidationFields.email(lang),
    }),
  });
};

export const resetPassword = (lang: LanguageEnum) => {
  return z.object({
    body: z
      .strictObject({
        email: generalValidationFields.email(lang),
        otp: generalValidationFields.otp(lang),
        password: generalValidationFields.password(lang),
        confirmPassword: generalValidationFields.confirmPassword(lang),
      })
      .superRefine((data, ctx) => {
        generalValidationFields.matchFields({ original: "password", copy: "confirmPassword", data, ctx, lang });
      }),
  });
};

export const update = (lang: LanguageEnum) => {
  return z.object({
    body: z.strictObject({
      userName: generalValidationFields.userName(lang).optional(),
      phone: generalValidationFields.phone(lang).optional(),
      gender: generalValidationFields.gender(lang).optional(),
    }),
  });
};

export const followUser = (lang: LanguageEnum) => {
  return z.object({
    params: z.strictObject({
      id: generalValidationFields.id(lang),
    }),
  });
};

export const search = (lang: LanguageEnum) => {
  return z.object({
    query: z.strictObject({
      search: z.string().min(2),
    }),
  });
};
