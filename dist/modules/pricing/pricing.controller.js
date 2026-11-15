"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingController = void 0;
const express_1 = require("express");
const exception_1 = require("../../common/exception");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const pricing_service_1 = require("./pricing.service");
const pricing_validation_1 = require("./pricing.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.post("/simulate", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(pricing_validation_1.pricingScenarioValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = pricing_service_1.pricingService.calculateScenario(req.validate.body);
    return { data };
}));
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    if (q.tripId)
        filter.tripId = q.tripId;
    if (q.status)
        filter.status = q.status;
    const repo = new pricing_service_1.PricingVersionRepository();
    const data = await repo.paginate({
        filter,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 25,
    });
    return { data };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(pricing_validation_1.pricingScenarioValidator), (0, middleware_1.responceFormatter)(async (req) => {
    if (!req.validate.body.code || !req.validate.body.name) {
        throw new exception_1.BadRequestException("code and name are required to persist a pricing version");
    }
    const data = await pricing_service_1.pricingService.createPricingVersion(req.validate.body, req);
    return { status: 201, data };
}));
router.patch("/:id/approve", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await pricing_service_1.pricingService.approvePricingVersion(req.params.id, req);
    return { data };
}));
exports.pricingController = router;
exports.default = router;
