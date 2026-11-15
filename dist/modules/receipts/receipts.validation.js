"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReceiptValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createReceiptValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        idempotencyKey: zod_1.z.string().optional(),
        bookingId: utils_1.generalValidationFields.id(lang).optional(),
        wholesaleContractId: utils_1.generalValidationFields.id(lang).optional(),
        branchId: utils_1.generalValidationFields.id(lang).optional(),
        cashboxId: utils_1.generalValidationFields.id(lang),
        amount: zod_1.z.number().positive(),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
        paymentMethod: zod_1.z.enum(["CASH", "BANK_TRANSFER", "POS_CARD", "CHEQUE"]).default("CASH"),
        referenceCode: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createReceiptValidator = createReceiptValidator;
