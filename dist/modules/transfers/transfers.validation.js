"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransferValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createTransferValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        fromCashboxId: utils_1.generalValidationFields.id(lang),
        toCashboxId: utils_1.generalValidationFields.id(lang),
        amount: zod_1.z.number().positive(),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createTransferValidator = createTransferValidator;
