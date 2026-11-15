"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBookingValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createBookingValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        idempotencyKey: zod_1.z.string().optional(),
        tripId: utils_1.generalValidationFields.id(lang),
        groupId: utils_1.generalValidationFields.id(lang).nullable().optional(),
        passengerId: utils_1.generalValidationFields.id(lang),
        branchId: utils_1.generalValidationFields.id(lang).optional(),
        pricingVersionId: utils_1.generalValidationFields.id(lang).optional(),
        roomType: zod_1.z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD"]),
        passengerCategory: zod_1.z.enum(["SINGLE", "DOUBLE", "TRIPLE", "QUAD", "CHILD", "INFANT"]).optional(),
        discountAmount: zod_1.z.number().min(0).default(0),
        status: zod_1.z.enum(["DRAFT", "ON_HOLD"]).default("ON_HOLD"),
        holdMinutes: zod_1.z.number().int().min(1).optional(),
        mahramPassengerId: utils_1.generalValidationFields.id(lang).nullable().optional(),
        familyGroupCode: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createBookingValidator = createBookingValidator;
