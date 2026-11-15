"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordLedgerAdjustmentValidator = exports.createSupplierValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createSupplierValidator = (_lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(2).max(20),
        nameAr: zod_1.z.string().min(2),
        nameEn: zod_1.z.string().min(2),
        type: zod_1.z.enum(["AIRLINE", "BROKER", "HOTEL", "SAUDI_AGENT", "TRANSPORT", "OTHER"]),
        contactPerson: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
        address: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        taxNumber: zod_1.z.string().optional(),
        commercialRegister: zod_1.z.string().optional(),
        bankDetails: zod_1.z
            .object({
            bankName: zod_1.z.string().optional(),
            accountName: zod_1.z.string().optional(),
            accountNumber: zod_1.z.string().optional(),
            iban: zod_1.z.string().optional(),
            swiftCode: zod_1.z.string().optional(),
        })
            .optional(),
        currency: zod_1.z.enum(["EGP", "SAR", "USD", "EUR"]).default("SAR"),
        openingBalance: zod_1.z.number().default(0),
        exchangeRateToEgp: zod_1.z.number().positive().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createSupplierValidator = createSupplierValidator;
const recordLedgerAdjustmentValidator = (lang) => zod_1.z.object({
    params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
    body: zod_1.z.object({
        entryType: zod_1.z.enum(["DEPOSIT", "PARTIAL_PAYMENT", "FULL_PAYMENT", "CREDIT_NOTE", "ADJUSTMENT"]),
        description: zod_1.z.string().min(3),
        debitAmount: zod_1.z.number().min(0).default(0),
        creditAmount: zod_1.z.number().min(0).default(0),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
        referenceNumber: zod_1.z.string().optional(),
        dueDate: zod_1.z.string().optional(),
    }),
});
exports.recordLedgerAdjustmentValidator = recordLedgerAdjustmentValidator;
