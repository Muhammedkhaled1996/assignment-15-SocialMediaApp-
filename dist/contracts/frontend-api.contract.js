"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = void 0;
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
