export enum UserRole {
  SUPER_ADMIN = 1,
  ADMIN = 2,
  BRANCH_MANAGER = 3,
  ACCOUNTANT = 4,
  SALES = 5,
  PROCUREMENT = 6,
  OPERATIONS = 7,
  EMPLOYEE = 8,
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "SUPER_ADMIN",
  [UserRole.ADMIN]: "ADMIN",
  [UserRole.BRANCH_MANAGER]: "BRANCH_MANAGER",
  [UserRole.ACCOUNTANT]: "ACCOUNTANT",
  [UserRole.SALES]: "SALES",
  [UserRole.PROCUREMENT]: "PROCUREMENT",
  [UserRole.OPERATIONS]: "OPERATIONS",
  [UserRole.EMPLOYEE]: "EMPLOYEE",
};

export const ALL_USER_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.SALES,
  UserRole.PROCUREMENT,
  UserRole.OPERATIONS,
  UserRole.EMPLOYEE,
];

export const CENTRAL_ADMIN_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
];

export const COMPANY_WIDE_ROLES: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.PROCUREMENT,
  UserRole.OPERATIONS,
];

export function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === "number" && ALL_USER_ROLES.includes(value as UserRole);
}

export enum GenderEnum {
  MALE = 0,
  FEMALE = 1,
}
