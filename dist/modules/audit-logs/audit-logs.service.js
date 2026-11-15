"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogService = exports.AuditLogService = exports.AuditLogRepository = void 0;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const middleware_1 = require("../../middleware");
class AuditLogRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.AuditLogModel);
    }
}
exports.AuditLogRepository = AuditLogRepository;
class AuditLogService {
    repo = new AuditLogRepository();
    async listAuditLogs(req) {
        const q = req.query;
        const filter = {};
        if (!req.branchContext?.isCentralAdmin) {
            Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
        }
        else if (q.branchId) {
            filter.branchId = q.branchId;
        }
        if (q.module)
            filter.module = q.module;
        if (q.action)
            filter.action = q.action;
        if (q.entityType)
            filter.entityType = q.entityType;
        if (q.entityId)
            filter.entityId = q.entityId;
        if (q.actorId)
            filter.actorId = q.actorId;
        if (q.fromDate || q.toDate) {
            filter.timestamp = {};
            if (q.fromDate)
                filter.timestamp.$gte = new Date(q.fromDate);
            if (q.toDate)
                filter.timestamp.$lte = new Date(q.toDate);
        }
        return await this.repo.paginate({
            filter,
            options: { sort: { timestamp: -1 } },
            page: Number(q.page) || 1,
            limit: Number(q.limit) || 50,
        });
    }
}
exports.AuditLogService = AuditLogService;
exports.auditLogService = new AuditLogService();
exports.default = exports.auditLogService;
