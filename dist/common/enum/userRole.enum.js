"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenderEnum = exports.userRole = void 0;
var userRole;
(function (userRole) {
    userRole[userRole["superAdmin"] = 8000] = "superAdmin";
    userRole[userRole["admin"] = 7000] = "admin";
    userRole[userRole["user"] = 6000] = "user";
})(userRole || (exports.userRole = userRole = {}));
var GenderEnum;
(function (GenderEnum) {
    GenderEnum[GenderEnum["MALE"] = 0] = "MALE";
    GenderEnum[GenderEnum["FEMALE"] = 1] = "FEMALE";
})(GenderEnum || (exports.GenderEnum = GenderEnum = {}));
