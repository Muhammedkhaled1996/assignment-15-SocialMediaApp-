"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userIdParam = exports.adminResetPassword = exports.changeUserRole = exports.updateProfile = exports.updateUser = exports.createStaffUser = void 0;
const zod_1 = require("zod");
const enum_1 = require("../../common/enum");
const utils_1 = require("../../common/utils");
const roleNumberValidator = zod_1.z
    .number()
    .int()
    .refine((val) => enum_1.ALL_USER_ROLES.includes(val), {
    message: "Invalid roleNumber. Must be one of: 1 (SUPER_ADMIN), 2 (ADMIN), 3 (BRANCH_MANAGER), 4 (ACCOUNTANT), 5 (SALES), 6 (PROCUREMENT), 7 (OPERATIONS), 8 (EMPLOYEE)",
});
const createStaffUser = (lang) => {
    return zod_1.z.object({
        body: zod_1.z
            .object({
            firstName: zod_1.z.string().min(2).max(50).optional(),
            lastName: zod_1.z.string().min(2).max(50).optional(),
            name: zod_1.z.string().min(2).max(100).optional(),
            userName: zod_1.z.string().min(2).max(100).optional(),
            email: utils_1.generalValidationFields.email(lang),
            password: utils_1.generalValidationFields.password(lang),
            roleNumber: roleNumberValidator.default(enum_1.UserRole.EMPLOYEE),
            branchId: utils_1.generalValidationFields.id(lang).nullable().optional(),
            primaryBranchId: utils_1.generalValidationFields.id(lang).nullable().optional(),
            assignedBranchIds: zod_1.z.array(utils_1.generalValidationFields.id(lang)).optional(),
            canAccessAllBranches: zod_1.z.boolean().optional(),
            isActive: zod_1.z.boolean().optional(),
            phone: zod_1.z.string().optional(),
            gender: utils_1.generalValidationFields.gender(lang).optional(),
            employeeCode: zod_1.z.string().optional(),
        })
            .refine((data) => Boolean((data.firstName && data.lastName) || data.name || data.userName), {
            message: "Provide either (firstName and lastName) or name",
            path: ["name"],
        }),
    });
};
exports.createStaffUser = createStaffUser;
const updateUser = (lang) => {
    return zod_1.z.object({
        params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
        body: zod_1.z.object({
            firstName: zod_1.z.string().min(2).max(50).optional(),
            lastName: zod_1.z.string().min(2).max(50).optional(),
            name: zod_1.z.string().min(2).max(100).optional(),
            userName: zod_1.z.string().min(2).max(100).optional(),
            email: utils_1.generalValidationFields.email(lang).optional(),
            phone: zod_1.z.string().optional(),
            gender: utils_1.generalValidationFields.gender(lang).optional(),
            branchId: utils_1.generalValidationFields.id(lang).nullable().optional(),
            primaryBranchId: utils_1.generalValidationFields.id(lang).nullable().optional(),
            assignedBranchIds: zod_1.z.array(utils_1.generalValidationFields.id(lang)).optional(),
            canAccessAllBranches: zod_1.z.boolean().optional(),
            isActive: zod_1.z.boolean().optional(),
            accountStatus: zod_1.z.enum(["ACTIVE", "SUSPENDED", "PENDING_ACTIVATION", "ARCHIVED"]).optional(),
            reason: zod_1.z.string().optional(),
            employeeCode: zod_1.z.string().optional(),
        }),
    });
};
exports.updateUser = updateUser;
const updateProfile = (lang) => {
    return zod_1.z.object({
        body: zod_1.z.strictObject({
            firstName: zod_1.z.string().min(2).max(50).optional(),
            lastName: zod_1.z.string().min(2).max(50).optional(),
            name: zod_1.z.string().min(2).max(100).optional(),
            userName: zod_1.z.string().min(2).max(100).optional(),
            phone: utils_1.generalValidationFields.phone(lang).optional(),
            gender: utils_1.generalValidationFields.gender(lang).optional(),
        }),
    });
};
exports.updateProfile = updateProfile;
const changeUserRole = (lang) => {
    return zod_1.z.object({
        params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
        body: zod_1.z.object({
            roleNumber: roleNumberValidator,
            reason: zod_1.z.string().optional(),
        }),
    });
};
exports.changeUserRole = changeUserRole;
const adminResetPassword = (lang) => {
    return zod_1.z.object({
        params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
        body: zod_1.z.object({
            newPassword: utils_1.generalValidationFields.password(lang),
        }),
    });
};
exports.adminResetPassword = adminResetPassword;
const userIdParam = (lang) => {
    return zod_1.z.object({
        params: zod_1.z.object({ id: utils_1.generalValidationFields.id(lang) }),
    });
};
exports.userIdParam = userIdParam;
