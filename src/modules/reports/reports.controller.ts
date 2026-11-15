import { Router, Request } from "express";
import { authentication, authorizeRoles, responceFormatter } from "../../middleware";
import { UserRole } from "../../common/enum";
import { reportService } from "./reports.service";

const router = Router({ caseSensitive: true, strict: true });

const REPORT_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.OPERATIONS,
];

router.get(
  "/trip-profitability",
  authentication(),
  authorizeRoles(...REPORT_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await reportService.getTripProfitabilityReport(req.query as any);
    return { data };
  }),
);

router.get(
  "/branch-performance",
  authentication(),
  authorizeRoles(...REPORT_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await reportService.getBranchPerformanceReport(req);
    return { data };
  }),
);

router.get(
  "/executive-summary",
  authentication(),
  authorizeRoles(...REPORT_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await reportService.getExecutiveSummary(req);
    return { data };
  }),
);

export const reportsController = router;
export default router;
