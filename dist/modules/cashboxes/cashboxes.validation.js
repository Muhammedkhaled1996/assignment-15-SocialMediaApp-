"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCashboxValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createCashboxValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(2),
        nameAr: zod_1.z.string().min(2),
        nameEn: zod_1.z.string().min(2),
        branchId: utils_1.generalValidationFields.id(lang).optional(),
        isMainCashbox: zod_1.z.boolean().default(false),
        currency: zod_1.z.enum(["EGP", "SAR", "USD"]).default("EGP"),
        openingBalance: zod_1.z.number().min(0).default(0),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
    }),
});
exports.createCashboxValidator = createCashboxValidator;
