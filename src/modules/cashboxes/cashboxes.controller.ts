import { Router, Request } from "express";
import { CashboxModel, FinancialTransactionModel } from "../../DB/module";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import { cashboxService } from "./cashboxes.service";
import { createCashboxValidator } from "./cashboxes.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.SALES,
    UserRole.EMPLOYEE,
  ),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));
    if (q.currency) filter.currency = q.currency;
    const cashboxes = await CashboxModel.find(filter).populate("branchId", "code nameAr nameEn").lean();
    return { data: cashboxes };
  }),
);

router.get(
  "/:id/transactions",
  authentication(),
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.SALES,
    UserRole.EMPLOYEE,
  ),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = { cashboxId: req.params.id };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));
    const transactions = await FinancialTransactionModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100)
      .lean();
    return { data: transactions };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT),
  validation(createCashboxValidator),
  responceFormatter(async (req: Request) => {
    const data = await cashboxService.createCashbox(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.post(
  "/:id/close-daily",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT),
  responceFormatter(async (req: Request) => {
    const data = await cashboxService.reconcileAndCloseDaily(
      req.params.id as string,
      Number(req.body.actualCountedBalance),
      req.body.notes,
      req,
    );
    return { status: 201, data };
  }),
);

export const cashboxesController = router;
export default router;
