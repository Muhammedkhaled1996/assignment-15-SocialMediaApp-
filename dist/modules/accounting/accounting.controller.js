"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountingController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const accounting_service_1 = require("./accounting.service");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/accounts", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async () => {
    await accounting_service_1.accountingService.ensureChartOfAccounts();
    const accounts = await module_1.AccountModel.find().sort({ code: 1 }).lean();
    return { data: accounts };
}));
router.get("/journal-entries", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    if (q.sourceModule)
        filter.sourceModule = q.sourceModule;
    if (q.branchId)
        filter.branchId = q.branchId;
    if (q.tripId)
        filter.tripId = q.tripId;
    if (q.status)
        filter.status = q.status;
    const entries = await module_1.JournalEntryModel.find(filter)
        .sort({ entryDate: -1, _id: -1 })
        .limit(Number(q.limit) || 100)
        .lean();
    return { data: entries };
}));
router.get("/financial-statements", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async () => {
    const data = await accounting_service_1.accountingService.getFinancialStatements();
    return { data };
}));
exports.accountingController = router;
exports.default = router;
