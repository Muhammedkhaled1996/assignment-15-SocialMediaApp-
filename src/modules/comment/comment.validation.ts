import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createComment = (lang: LanguageEnum) => {
  return z
    .object({
      body: z.strictObject({
        content: z.string().optional(),
      }),
      params: z.strictObject({
        postId: generalValidationFields.id(lang),
      }),
      files: z.array(generalValidationFields.file(lang)).max(1).optional(),
    })
    .superRefine((data, ctx) => {
      const hasContent = Boolean(data.body?.content?.trim());
      const hasFiles = Boolean(data.files && data.files.length > 0);

      if (!hasContent && !hasFiles) {
        ctx.addIssue({
          code: "custom",
          message:
            lang === LanguageEnum.EN ? "Missing post content or attachments" : "يجب إدخال محتوى للمنشور أو إرفاق ملفات",
          path: ["body", "content"],
        });
      }
    });
};

export const updateComment = (lang: LanguageEnum) => {
  return z
    .object({
      body: z.strictObject({
        content: z.string().optional(),
      }),
      params: z.strictObject({
        commentId: generalValidationFields.id(lang),
      }),
      files: z.array(generalValidationFields.file(lang)).max(1).optional(),
    })
    .superRefine((data, ctx) => {
      const hasContent = Boolean(data.body?.content?.trim());
      const hasFiles = Boolean(data.files && data.files.length > 0);

      if (!hasContent && !hasFiles) {
        ctx.addIssue({
          code: "custom",
          message:
            lang === LanguageEnum.EN
              ? "Missing comment content or attachments"
              : "يجب إدخال محتوى للتعليق أو إرفاق ملفات",
          path: ["body", "content"],
        });
      }
    });
};

export const deleteComment = (lang: LanguageEnum) => {
  return z.object({
    params: z.strictObject({
      commentId: generalValidationFields.id(lang),
    }),
  });
};
