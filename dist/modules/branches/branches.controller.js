"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.branchesController = void 0;
const express_1 = require("express");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const branches_service_1 = require("./branches.service");
const branches_validation_1 = require("./branches.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await branches_service_1.branchService.listBranches(req.query, req);
    return { data };
}));
router.get("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await branches_service_1.branchService.getBranchById(req.params.id, req);
    return { data };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN), (0, middleware_1.validation)(branches_validation_1.createBranchValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await branches_service_1.branchService.createBranch(req.validate.body, req);
    return { status: 201, data };
}));
router.patch("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN), (0, middleware_1.validation)(branches_validation_1.updateBranchValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await branches_service_1.branchService.updateBranch(req.validate.params.id, req.validate.body, req);
    return { data };
}));
exports.branchesController = router;
exports.default = router;
