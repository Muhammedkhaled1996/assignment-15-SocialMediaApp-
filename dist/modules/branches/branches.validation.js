"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateBranchValidator = exports.createBranchValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createBranchValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(2).max(15),
        nameAr: zod_1.z.string().min(2),
        nameEn: zod_1.z.string().min(2),
        governorate: zod_1.z.string().min(2),
        city: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
        managerId: utils_1.generalValidationFields.id(lang).optional(),
        isHeadquarters: zod_1.z.boolean().optional(),
        status: zod_1.z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    }),
});
exports.createBranchValidator = createBranchValidator;
const updateBranchValidator = (lang) => zod_1.z.object({
    params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
    body: zod_1.z.object({
        nameAr: zod_1.z.string().min(2).optional(),
        nameEn: zod_1.z.string().min(2).optional(),
        governorate: zod_1.z.string().min(2).optional(),
        city: zod_1.z.string().optional(),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
        managerId: utils_1.generalValidationFields.id(lang).optional(),
        status: zod_1.z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
    }),
});
exports.updateBranchValidator = updateBranchValidator;
