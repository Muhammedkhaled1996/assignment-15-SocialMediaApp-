"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPost = void 0;
const zod_1 = require("zod");
const enum_1 = require("../../common/enum");
const utils_1 = require("../../common/utils");
const createPost = (lang) => {
    return zod_1.z
        .object({
        body: zod_1.z.strictObject({
            content: zod_1.z.string().optional(),
        }),
        files: zod_1.z.array(utils_1.generalValidationFields.file(lang)).max(10).optional(),
    })
        .superRefine((data, ctx) => {
        const hasContent = Boolean(data.body?.content?.trim());
        const hasFiles = Boolean(data.files && data.files.length > 0);
        if (!hasContent && !hasFiles) {
            ctx.addIssue({
                code: "custom",
                message: lang === enum_1.LanguageEnum.EN ? "Missing post content or attachments" : "يجب إدخال محتوى للمنشور أو إرفاق ملفات",
                path: ["body", "content"],
            });
        }
    });
};
exports.createPost = createPost;
