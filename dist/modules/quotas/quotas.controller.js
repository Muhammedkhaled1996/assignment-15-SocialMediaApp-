"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quotasController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const quotas_service_1 = require("./quotas.service");
const quotas_validation_1 = require("./quotas.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
const QUOTA_READ_ROLES = [
    enum_1.UserRole.SUPER_ADMIN,
    enum_1.UserRole.ADMIN,
    enum_1.UserRole.BRANCH_MANAGER,
    enum_1.UserRole.SALES,
    enum_1.UserRole.OPERATIONS,
    enum_1.UserRole.EMPLOYEE,
];
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...QUOTA_READ_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    if (q.tripId)
        filter.tripId = q.tripId;
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    const quotas = await module_1.BranchQuotaModel.find(filter)
        .populate("tripId", "code nameAr nameEn departureDate capacity availableInventory quotaMode")
        .populate("branchId", "code nameAr nameEn")
        .lean();
    return { data: quotas };
}));
router.get("/movements", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...QUOTA_READ_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    if (q.tripId)
        filter.tripId = q.tripId;
    if (!req.branchContext?.isCentralAdmin) {
        Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    }
    else if (q.branchId) {
        filter.branchId = q.branchId;
    }
    const movements = await module_1.InventoryMovementModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(q.limit) || 100)
        .lean();
    return { data: movements };
}));
router.post("/allocate", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(quotas_validation_1.allocateValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await quotas_service_1.quotaService.allocateToBranch({ ...req.validate.body, req });
    return { status: 201, data };
}));
router.post("/transfer", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(quotas_validation_1.transferValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await quotas_service_1.quotaService.transferBetweenBranches({ ...req.validate.body, req });
    return { data };
}));
router.post("/release", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(quotas_validation_1.allocateValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await quotas_service_1.quotaService.releaseFromBranch({ ...req.validate.body, req });
    return { data };
}));
exports.quotasController = router;
exports.default = router;
