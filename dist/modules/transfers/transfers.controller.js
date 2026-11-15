"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transfersController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const transfers_service_1 = require("./transfers.service");
const transfers_validation_1 = require("./transfers.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.responceFormatter)(async () => {
    const transfers = await module_1.CashTransferModel.find()
        .populate("fromCashboxId toCashboxId", "code nameAr nameEn")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
    return { data: transfers };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT), (0, middleware_1.validation)(transfers_validation_1.createTransferValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await transfers_service_1.transferService.createTransfer(req.validate.body, req);
    return { status: 201, data };
}));
exports.transfersController = router;
exports.default = router;
