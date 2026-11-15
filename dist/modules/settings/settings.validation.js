"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertSettingValidator = void 0;
const zod_1 = require("zod");
const upsertSettingValidator = (_lang) => zod_1.z.object({
    params: zod_1.z.object({ key: zod_1.z.string().min(1) }),
    body: zod_1.z.object({
        value: zod_1.z.any(),
        category: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
    }),
});
exports.upsertSettingValidator = upsertSettingValidator;
