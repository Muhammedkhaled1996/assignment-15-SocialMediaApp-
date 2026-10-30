"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenderEnum = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole[UserRole["superAdmin"] = 0] = "superAdmin";
    UserRole[UserRole["admin"] = 1] = "admin";
    UserRole[UserRole["user"] = 2] = "user";
})(UserRole || (exports.UserRole = UserRole = {}));
var GenderEnum;
(function (GenderEnum) {
    GenderEnum[GenderEnum["MALE"] = 0] = "MALE";
    GenderEnum[GenderEnum["FEMALE"] = 1] = "FEMALE";
})(GenderEnum || (exports.GenderEnum = GenderEnum = {}));
