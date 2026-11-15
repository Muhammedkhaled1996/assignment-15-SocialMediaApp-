"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wholesaleController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const wholesale_service_1 = require("./wholesale.service");
const wholesale_validation_1 = require("./wholesale.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/partners", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async () => {
    const partners = await module_1.WholesalePartnerModel.find().sort({ companyNameEn: 1 }).lean();
    return { data: partners };
}));
router.post("/partners", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(wholesale_validation_1.createPartnerValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await wholesale_service_1.wholesaleService.createPartner(req.validate.body, req);
    return { status: 201, data };
}));
router.get("/contracts", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = {};
    if (!req.branchContext?.isCentralAdmin) {
        Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, req.query.branchId, "branchId"));
    }
    if (req.query.tripId)
        filter.tripId = req.query.tripId;
    if (req.query.partnerId)
        filter.partnerId = req.query.partnerId;
    const contracts = await module_1.WholesaleContractModel.find(filter)
        .populate("partnerId", "code companyNameAr companyNameEn")
        .populate("tripId", "code nameAr nameEn departureDate")
        .sort({ createdAt: -1 })
        .lean();
    return { data: contracts };
}));
router.post("/contracts", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(wholesale_validation_1.createContractValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await wholesale_service_1.wholesaleService.createWholesaleContract(req.validate.body, req);
    return { status: 201, data };
}));
router.post("/contracts/:id/release-seats", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await wholesale_service_1.wholesaleService.releaseWholesaleSeats(req.params.id, Number(req.body.quantity), req);
    return { data };
}));
exports.wholesaleController = router;
exports.default = router;
