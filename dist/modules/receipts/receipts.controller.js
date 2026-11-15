"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptsController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const receipts_service_1 = require("./receipts.service");
const receipts_validation_1 = require("./receipts.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
const RECEIPT_ROLES = [
    enum_1.UserRole.SUPER_ADMIN,
    enum_1.UserRole.ADMIN,
    enum_1.UserRole.BRANCH_MANAGER,
    enum_1.UserRole.ACCOUNTANT,
    enum_1.UserRole.SALES,
    enum_1.UserRole.EMPLOYEE,
];
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...RECEIPT_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    if (q.bookingId)
        filter.bookingId = q.bookingId;
    if (q.tripId)
        filter.tripId = q.tripId;
    if (q.receiptType)
        filter.receiptType = q.receiptType;
    const receipts = await module_1.ReceiptModel.find(filter)
        .populate("bookingId", "bookingNumber netSellingPrice amountPaid remainingBalance")
        .populate("passengerId", "arabicName englishName passportNumber")
        .populate("cashboxId", "code nameAr nameEn")
        .sort({ createdAt: -1 })
        .limit(Number(q.limit) || 50)
        .lean();
    return { data: receipts };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...RECEIPT_ROLES), (0, middleware_1.validation)(receipts_validation_1.createReceiptValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await receipts_service_1.receiptService.createReceipt(req.validate.body, req);
    return { status: 201, data };
}));
router.post("/refund", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await receipts_service_1.receiptService.createRefundVoucher(req.body, req);
    return { status: 201, data };
}));
exports.receiptsController = router;
exports.default = router;
