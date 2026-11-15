"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsController = void 0;
const express_1 = require("express");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const reports_service_1 = require("./reports.service");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
const REPORT_ROLES = [
    enum_1.UserRole.SUPER_ADMIN,
    enum_1.UserRole.ADMIN,
    enum_1.UserRole.BRANCH_MANAGER,
    enum_1.UserRole.ACCOUNTANT,
    enum_1.UserRole.OPERATIONS,
];
router.get("/trip-profitability", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...REPORT_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await reports_service_1.reportService.getTripProfitabilityReport(req.query);
    return { data };
}));
router.get("/branch-performance", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...REPORT_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await reports_service_1.reportService.getBranchPerformanceReport(req);
    return { data };
}));
router.get("/executive-summary", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...REPORT_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await reports_service_1.reportService.getExecutiveSummary(req);
    return { data };
}));
exports.reportsController = router;
exports.default = router;
