import { Router, Request } from "express";
import { authentication, authorizeRoles, responceFormatter } from "../../middleware";
import { UserRole } from "../../common/enum";
import { auditLogService } from "./audit-logs.service";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  responceFormatter(async (req: Request) => {
    const data = await auditLogService.listAuditLogs(req);
    return { data };
  }),
);

export const auditLogsController = router;
export default router;
