"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authentication_middleware_js_1 = require("../../middleware/authentication.middleware.js");
const users_services_1 = __importDefault(require("./users.services"));
const responce_middleware_js_1 = require("../../middleware/responce.middleware.js");
const validation_middleware_js_1 = require("../../middleware/validation.middleware.js");
const validator = __importStar(require("./user.validation.js"));
const index_js_1 = require("../../common/enum/index.js");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.patch("/profile", (0, authentication_middleware_js_1.authentication)(), (0, validation_middleware_js_1.validation)(validator.updateProfile), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.updateProfile(req.user, req.validate.body);
    return { data };
}));
router.get("/", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN, index_js_1.UserRole.BRANCH_MANAGER), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.listStaffUsers(req.query, req.branchContext);
    return { data };
}));
router.post("/", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN), (0, validation_middleware_js_1.validation)(validator.createStaffUser), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.createStaffUser(req.validate.body, req.user, req.branchContext);
    return { status: 201, data };
}));
router.get("/:id", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN, index_js_1.UserRole.BRANCH_MANAGER), (0, validation_middleware_js_1.validation)(validator.userIdParam), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.getUserById(req.validate.params.id, req.user, req.branchContext);
    return { data };
}));
router.patch("/:id", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN), (0, validation_middleware_js_1.validation)(validator.updateUser), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.updateUser(req.validate.params.id, req.validate.body, req.user, req.branchContext);
    return { data };
}));
router.patch("/:id/role", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN), (0, validation_middleware_js_1.validation)(validator.changeUserRole), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.changeUserRole(req.validate.params.id, req.validate.body.roleNumber, req.user, req.validate.body.reason);
    return { data };
}));
router.patch("/:id/reset-password", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN), (0, validation_middleware_js_1.validation)(validator.adminResetPassword), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.adminResetPassword(req.validate.params.id, req.validate.body.newPassword, req.user);
    return { data };
}));
router.delete("/:id", (0, authentication_middleware_js_1.authentication)(), (0, authentication_middleware_js_1.authorizeRoles)(index_js_1.UserRole.SUPER_ADMIN, index_js_1.UserRole.ADMIN), (0, validation_middleware_js_1.validation)(validator.userIdParam), (0, responce_middleware_js_1.responceFormatter)(async (req) => {
    const data = await users_services_1.default.deleteOrDeactivateUser(req.validate.params.id, req.user, req.branchContext);
    return { data };
}));
exports.default = router;
