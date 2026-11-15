"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentsController = void 0;
const express_1 = require("express");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const documents_service_1 = require("./documents.service");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
const DOC_READ_ROLES = [
    enum_1.UserRole.SUPER_ADMIN,
    enum_1.UserRole.ADMIN,
    enum_1.UserRole.BRANCH_MANAGER,
    enum_1.UserRole.ACCOUNTANT,
    enum_1.UserRole.SALES,
    enum_1.UserRole.OPERATIONS,
    enum_1.UserRole.EMPLOYEE,
];
router.get("/flyer/:tripId", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...DOC_READ_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await documents_service_1.documentService.getFlyerData(req.params.tripId, req.query.branchId || req.branchContext?.activeBranchId);
    return { data };
}));
router.get("/manifest/:tripId", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...DOC_READ_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await documents_service_1.documentService.getPassengerManifest(req.params.tripId, req);
    return { data };
}));
router.get("/rooming-list/:tripId", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...DOC_READ_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const city = req.query.city ? String(req.query.city).toUpperCase().trim() : undefined;
    const data = await documents_service_1.documentService.getRoomingList(req.params.tripId, city, req);
    return { data };
}));
router.get("/receipts/:receiptId", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...DOC_READ_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await documents_service_1.documentService.getReceiptPrintData(req.params.receiptId, req);
    return { data };
}));
exports.documentsController = router;
exports.default = router;
