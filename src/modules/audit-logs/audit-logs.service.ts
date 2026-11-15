import { Request } from "express";
import { AuditLogModel } from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { resolveScopedBranchFilter } from "../../middleware";

export class AuditLogRepository extends DatabaseRepository<any> {
  constructor() {
    super(AuditLogModel);
  }
}

export class AuditLogService {
  private repo = new AuditLogRepository();

  async listAuditLogs(req: Request) {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};

    if (!req.branchContext?.isCentralAdmin) {
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));
    } else if (q.branchId) {
      filter.branchId = q.branchId;
    }

    if (q.module) filter.module = q.module;
    if (q.action) filter.action = q.action;
    if (q.entityType) filter.entityType = q.entityType;
    if (q.entityId) filter.entityId = q.entityId;
    if (q.actorId) filter.actorId = q.actorId;
    if (q.fromDate || q.toDate) {
      filter.timestamp = {};
      if (q.fromDate) filter.timestamp.$gte = new Date(q.fromDate);
      if (q.toDate) filter.timestamp.$lte = new Date(q.toDate);
    }

    return await this.repo.paginate({
      filter,
      options: { sort: { timestamp: -1 } },
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 50,
    });
  }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
