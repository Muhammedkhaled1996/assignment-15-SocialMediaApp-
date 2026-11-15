"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPassengerValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createPassengerValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        branchId: utils_1.generalValidationFields.id(lang).optional(),
        arabicName: zod_1.z.string().min(4),
        englishName: zod_1.z.string().min(4),
        nationalId: zod_1.z.string().length(14),
        gender: zod_1.z.enum(["MALE", "FEMALE"]).optional(),
        nationality: zod_1.z.string().default("EG"),
        occupation: zod_1.z.string().optional(),
        governorate: zod_1.z.string().optional(),
        phone: zod_1.z.string().min(8),
        passportNumber: zod_1.z.string().min(5).optional(),
        passportIssueDate: zod_1.z.string().optional(),
        passportExpirationDate: zod_1.z.string().optional(),
        passportAttachments: zod_1.z.array(zod_1.z.string()).default([]),
        emergencyContact: zod_1.z
            .object({
            name: zod_1.z.string(),
            relation: zod_1.z.string(),
            phone: zod_1.z.string(),
        })
            .optional(),
        mahramPassengerId: utils_1.generalValidationFields.id(lang).nullable().optional(),
        mahramRelationship: zod_1.z.string().optional(),
        familyGroupCode: zod_1.z.string().optional(),
        ocrRawDraft: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
    }),
});
exports.createPassengerValidator = createPassengerValidator;
