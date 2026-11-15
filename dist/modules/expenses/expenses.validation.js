"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpenseValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createExpenseValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        voucherType: zod_1.z.enum(["OPERATIONAL_EXPENSE", "SUPPLIER_PAYMENT"]).default("OPERATIONAL_EXPENSE"),
        branchId: utils_1.generalValidationFields.id(lang).optional(),
        cashboxId: utils_1.generalValidationFields.id(lang),
        tripId: utils_1.generalValidationFields.id(lang).optional(),
        supplierId: utils_1.generalValidationFields.id(lang).optional(),
        flightLotId: utils_1.generalValidationFields.id(lang).optional(),
        hotelContractId: utils_1.generalValidationFields.id(lang).optional(),
        category: zod_1.z.string().min(2),
        amount: zod_1.z.number().positive(),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
        paymentMethod: zod_1.z.enum(["CASH", "BANK_TRANSFER", "CHEQUE"]).default("CASH"),
        description: zod_1.z.string().min(3),
    }),
});
exports.createExpenseValidator = createExpenseValidator;
