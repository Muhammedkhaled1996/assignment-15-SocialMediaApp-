import { Router, Request } from "express";
import { AccountModel, JournalEntryModel } from "../../DB/module";
import { authentication, authorizeRoles, responceFormatter } from "../../middleware";
import { UserRole } from "../../common/enum";
import { accountingService } from "./accounting.service";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/accounts",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT),
  responceFormatter(async () => {
    await accountingService.ensureChartOfAccounts();
    const accounts = await AccountModel.find().sort({ code: 1 }).lean();
    return { data: accounts };
  }),
);

router.get(
  "/journal-entries",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (q.sourceModule) filter.sourceModule = q.sourceModule;
    if (q.branchId) filter.branchId = q.branchId;
    if (q.tripId) filter.tripId = q.tripId;
    if (q.status) filter.status = q.status;
    const entries = await JournalEntryModel.find(filter)
      .sort({ entryDate: -1, _id: -1 })
      .limit(Number(q.limit) || 100)
      .lean();
    return { data: entries };
  }),
);

router.get(
  "/financial-statements",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT),
  responceFormatter(async () => {
    const data = await accountingService.getFinancialStatements();
    return { data };
  }),
);

export const accountingController = router;
export default router;
