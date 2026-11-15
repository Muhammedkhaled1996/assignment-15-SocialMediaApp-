"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cashboxesController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const cashboxes_service_1 = require("./cashboxes.service");
const cashboxes_validation_1 = require("./cashboxes.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.EMPLOYEE), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    if (q.currency)
        filter.currency = q.currency;
    const cashboxes = await module_1.CashboxModel.find(filter).populate("branchId", "code nameAr nameEn").lean();
    return { data: cashboxes };
}));
router.get("/:id/transactions", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.EMPLOYEE), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = { cashboxId: req.params.id };
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
    const transactions = await module_1.FinancialTransactionModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(Number(req.query.limit) || 100)
        .lean();
    return { data: transactions };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.validation)(cashboxes_validation_1.createCashboxValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await cashboxes_service_1.cashboxService.createCashbox(req.validate.body, req);
    return { status: 201, data };
}));
router.post("/:id/close-daily", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await cashboxes_service_1.cashboxService.reconcileAndCloseDaily(req.params.id, Number(req.body.actualCountedBalance), req.body.notes, req);
    return { status: 201, data };
}));
exports.cashboxesController = router;
exports.default = router;
