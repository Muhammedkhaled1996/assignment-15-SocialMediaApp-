"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expensesController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const expenses_service_1 = require("./expenses.service");
const expenses_validation_1 = require("./expenses.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    if (q.voucherType)
        filter.voucherType = q.voucherType;
    if (q.tripId)
        filter.tripId = q.tripId;
    if (q.supplierId)
        filter.supplierId = q.supplierId;
    const expenses = await module_1.ExpenseModel.find(filter)
        .populate("supplierId", "code nameAr nameEn")
        .populate("cashboxId", "code nameAr nameEn")
        .sort({ createdAt: -1 })
        .limit(Number(q.limit) || 50)
        .lean();
    return { data: expenses };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.validation)(expenses_validation_1.createExpenseValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await expenses_service_1.expenseService.createExpenseOrSupplierPayment(req.validate.body, req);
    return { status: 201, data };
}));
exports.expensesController = router;
exports.default = router;
