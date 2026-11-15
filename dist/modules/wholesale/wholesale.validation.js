"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContractValidator = exports.createPartnerValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createPartnerValidator = (_lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(2),
        companyNameAr: zod_1.z.string().min(2),
        companyNameEn: zod_1.z.string().min(2),
        tourismLicenseNumber: zod_1.z.string().optional(),
        taxNumber: zod_1.z.string().optional(),
        contactPerson: zod_1.z.string().min(2),
        phone: zod_1.z.string().min(6),
        email: zod_1.z.string().email().optional(),
        address: zod_1.z.string().optional(),
    }),
});
exports.createPartnerValidator = createPartnerValidator;
const createContractValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        contractNumber: zod_1.z.string().optional(),
        partnerId: utils_1.generalValidationFields.id(lang),
        tripId: utils_1.generalValidationFields.id(lang),
        branchId: utils_1.generalValidationFields.id(lang).optional(),
        allocationType: zod_1.z.enum(["SEAT_BLOCK", "ENTIRE_TRIP"]).default("SEAT_BLOCK"),
        seatQuantity: zod_1.z.number().int().min(1).optional(),
        unitPriceEgp: zod_1.z.number().min(0),
        depositAmountEgp: zod_1.z.number().min(0).default(0),
        paymentSchedule: zod_1.z
            .array(zod_1.z.object({
            dueDate: zod_1.z.string(),
            amount: zod_1.z.number().min(0),
        }))
            .optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createContractValidator = createContractValidator;
