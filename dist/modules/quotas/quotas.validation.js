"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferValidator = exports.allocateValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const allocateValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        tripId: utils_1.generalValidationFields.id(lang),
        branchId: utils_1.generalValidationFields.id(lang),
        quantity: zod_1.z.number().int().min(1),
        notes: zod_1.z.string().optional(),
    }),
});
exports.allocateValidator = allocateValidator;
const transferValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        tripId: utils_1.generalValidationFields.id(lang),
        fromBranchId: utils_1.generalValidationFields.id(lang),
        toBranchId: utils_1.generalValidationFields.id(lang),
        quantity: zod_1.z.number().int().min(1),
        notes: zod_1.z.string().optional(),
    }),
});
exports.transferValidator = transferValidator;
