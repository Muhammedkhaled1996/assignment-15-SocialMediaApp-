"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogsController = void 0;
const express_1 = require("express");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const audit_logs_service_1 = require("./audit-logs.service");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await audit_logs_service_1.auditLogService.listAuditLogs(req);
    return { data };
}));
exports.auditLogsController = router;
exports.default = router;
