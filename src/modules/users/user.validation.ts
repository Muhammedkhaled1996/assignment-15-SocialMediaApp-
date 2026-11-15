import { z } from "zod";
import { ALL_USER_ROLES, LanguageEnum, UserRole } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

const roleNumberValidator = z
  .number()
  .int()
  .refine((val) => ALL_USER_ROLES.includes(val as UserRole), {
    message:
      "Invalid roleNumber. Must be one of: 1 (SUPER_ADMIN), 2 (ADMIN), 3 (BRANCH_MANAGER), 4 (ACCOUNTANT), 5 (SALES), 6 (PROCUREMENT), 7 (OPERATIONS), 8 (EMPLOYEE)",
  });

export const createStaffUser = (lang: LanguageEnum) => {
  return z.object({
    body: z
      .object({
        firstName: z.string().min(2).max(50).optional(),
        lastName: z.string().min(2).max(50).optional(),
        name: z.string().min(2).max(100).optional(),
        userName: z.string().min(2).max(100).optional(),
        email: generalValidationFields.email(lang),
        password: generalValidationFields.password(lang),
        roleNumber: roleNumberValidator.default(UserRole.EMPLOYEE),
        branchId: generalValidationFields.id(lang).nullable().optional(),
        primaryBranchId: generalValidationFields.id(lang).nullable().optional(),
        assignedBranchIds: z.array(generalValidationFields.id(lang)).optional(),
        canAccessAllBranches: z.boolean().optional(),
        isActive: z.boolean().optional(),
        phone: z.string().optional(),
        gender: generalValidationFields.gender(lang).optional(),
        employeeCode: z.string().optional(),
      })
      .refine((data) => Boolean((data.firstName && data.lastName) || data.name || data.userName), {
        message: "Provide either (firstName and lastName) or name",
        path: ["name"],
      }),
  });
};

export const updateUser = (lang: LanguageEnum) => {
  return z.object({
    params: z.object({ id: generalValidationFields.id(lang) }),
    body: z.object({
      firstName: z.string().min(2).max(50).optional(),
      lastName: z.string().min(2).max(50).optional(),
      name: z.string().min(2).max(100).optional(),
      userName: z.string().min(2).max(100).optional(),
      email: generalValidationFields.email(lang).optional(),
      phone: z.string().optional(),
      gender: generalValidationFields.gender(lang).optional(),
      branchId: generalValidationFields.id(lang).nullable().optional(),
      primaryBranchId: generalValidationFields.id(lang).nullable().optional(),
      assignedBranchIds: z.array(generalValidationFields.id(lang)).optional(),
      canAccessAllBranches: z.boolean().optional(),
      isActive: z.boolean().optional(),
      accountStatus: z.enum(["ACTIVE", "SUSPENDED", "PENDING_ACTIVATION", "ARCHIVED"]).optional(),
      reason: z.string().optional(),
      employeeCode: z.string().optional(),
    }),
  });
};

export const updateProfile = (lang: LanguageEnum) => {
  return z.object({
    body: z.strictObject({
      firstName: z.string().min(2).max(50).optional(),
      lastName: z.string().min(2).max(50).optional(),
      name: z.string().min(2).max(100).optional(),
      userName: z.string().min(2).max(100).optional(),
      phone: generalValidationFields.phone(lang).optional(),
      gender: generalValidationFields.gender(lang).optional(),
    }),
  });
};

export const changeUserRole = (lang: LanguageEnum) => {
  return z.object({
    params: z.object({ id: generalValidationFields.id(lang) }),
    body: z.object({
      roleNumber: roleNumberValidator,
      reason: z.string().optional(),
    }),
  });
};

export const adminResetPassword = (lang: LanguageEnum) => {
  return z.object({
    params: z.object({ id: generalValidationFields.id(lang) }),
    body: z.object({
      newPassword: generalValidationFields.password(lang),
    }),
  });
};

export const userIdParam = (lang: LanguageEnum) => {
  return z.object({
    params: z.object({ id: generalValidationFields.id(lang) }),
  });
};
