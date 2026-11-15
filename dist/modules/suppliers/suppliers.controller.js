"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.suppliersController = void 0;
const express_1 = require("express");
const service_1 = require("../../common/service");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const utils_1 = require("../../common/utils");
const suppliers_service_1 = require("./suppliers.service");
const suppliers_validation_1 = require("./suppliers.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
const SUPPLIER_ROLES = [
    enum_1.UserRole.SUPER_ADMIN,
    enum_1.UserRole.ADMIN,
    enum_1.UserRole.ACCOUNTANT,
    enum_1.UserRole.PROCUREMENT,
    enum_1.UserRole.OPERATIONS,
];
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...SUPPLIER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await suppliers_service_1.supplierService.listSuppliers(req.query);
    return { data };
}));
router.get("/aging-report", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...SUPPLIER_ROLES), (0, middleware_1.responceFormatter)(async () => {
    const data = await suppliers_service_1.supplierService.getAgingAndScheduleReport();
    return { data };
}));
router.get("/:id/statement", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...SUPPLIER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await suppliers_service_1.supplierService.getSupplierStatement(req.params.id, req.query);
    return { data };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...SUPPLIER_ROLES), (0, middleware_1.validation)(suppliers_validation_1.createSupplierValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await suppliers_service_1.supplierService.createSupplier(req.validate.body, req);
    return { status: 201, data };
}));
router.post("/:id/ledger-entries", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...SUPPLIER_ROLES), (0, middleware_1.validation)(suppliers_validation_1.recordLedgerAdjustmentValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const body = req.validate.body;
    const data = await (0, utils_1.withTransaction)(async (session) => {
        const res = await suppliers_service_1.supplierService.recordLedgerMovement({
            supplierId: req.validate.params.id,
            branchId: req.branchContext?.activeBranchId,
            entryType: body.entryType,
            referenceType: "MANUAL_ADJUSTMENT",
            referenceId: req.validate.params.id,
            referenceNumber: body.referenceNumber,
            description: body.description,
            debitAmount: body.debitAmount,
            creditAmount: body.creditAmount,
            exchangeRateToEgp: body.exchangeRateToEgp,
            dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
            actorId: req.user?._id,
            session,
        });
        await service_1.auditService.record({
            req,
            action: `SUPPLIER_LEDGER_${body.entryType}`,
            module: "suppliers",
            entityType: "SupplierLedgerEntry",
            entityId: res.entry._id.toString(),
            newValues: res.entry.toObject(),
            session,
        });
        return res;
    });
    return { status: 201, data };
}));
exports.suppliersController = router;
exports.default = router;
