"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenderEnum = exports.COMPANY_WIDE_ROLES = exports.CENTRAL_ADMIN_ROLES = exports.ALL_USER_ROLES = exports.USER_ROLE_LABELS = exports.UserRole = void 0;
exports.isValidUserRole = isValidUserRole;
var UserRole;
(function (UserRole) {
    UserRole[UserRole["SUPER_ADMIN"] = 1] = "SUPER_ADMIN";
    UserRole[UserRole["ADMIN"] = 2] = "ADMIN";
    UserRole[UserRole["BRANCH_MANAGER"] = 3] = "BRANCH_MANAGER";
    UserRole[UserRole["ACCOUNTANT"] = 4] = "ACCOUNTANT";
    UserRole[UserRole["SALES"] = 5] = "SALES";
    UserRole[UserRole["PROCUREMENT"] = 6] = "PROCUREMENT";
    UserRole[UserRole["OPERATIONS"] = 7] = "OPERATIONS";
    UserRole[UserRole["EMPLOYEE"] = 8] = "EMPLOYEE";
})(UserRole || (exports.UserRole = UserRole = {}));
exports.USER_ROLE_LABELS = {
    [UserRole.SUPER_ADMIN]: "SUPER_ADMIN",
    [UserRole.ADMIN]: "ADMIN",
    [UserRole.BRANCH_MANAGER]: "BRANCH_MANAGER",
    [UserRole.ACCOUNTANT]: "ACCOUNTANT",
    [UserRole.SALES]: "SALES",
    [UserRole.PROCUREMENT]: "PROCUREMENT",
    [UserRole.OPERATIONS]: "OPERATIONS",
    [UserRole.EMPLOYEE]: "EMPLOYEE",
};
exports.ALL_USER_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.SALES,
    UserRole.PROCUREMENT,
    UserRole.OPERATIONS,
    UserRole.EMPLOYEE,
];
exports.CENTRAL_ADMIN_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
];
exports.COMPANY_WIDE_ROLES = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT,
    UserRole.OPERATIONS,
];
function isValidUserRole(value) {
    return typeof value === "number" && exports.ALL_USER_ROLES.includes(value);
}
var GenderEnum;
(function (GenderEnum) {
    GenderEnum[GenderEnum["MALE"] = 0] = "MALE";
    GenderEnum[GenderEnum["FEMALE"] = 1] = "FEMALE";
})(GenderEnum || (exports.GenderEnum = GenderEnum = {}));
