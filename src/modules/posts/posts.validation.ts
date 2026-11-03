import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createPost = (lang: LanguageEnum) => {
  return z
    .object({
      body: z.strictObject({
        content: z.string().min(2).max(100).optional(),
      }),
      files: z.array(generalValidationFields.file(lang)).max(10).optional(),
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
