import { Router, Request } from "express";
import { ExpenseModel } from "../../DB/module";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import { expenseService } from "./expenses.service";
import { createExpenseValidator } from "./expenses.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));
    if (q.voucherType) filter.voucherType = q.voucherType;
    if (q.tripId) filter.tripId = q.tripId;
    if (q.supplierId) filter.supplierId = q.supplierId;
    const expenses = await ExpenseModel.find(filter)
      .populate("supplierId", "code nameAr nameEn")
      .populate("cashboxId", "code nameAr nameEn")
      .sort({ createdAt: -1 })
      .limit(Number(q.limit) || 50)
      .lean();
    return { data: expenses };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT),
  validation(createExpenseValidator),
  responceFormatter(async (req: Request) => {
    const data = await expenseService.createExpenseOrSupplierPayment(req.validate.body, req);
    return { status: 201, data };
  }),
);

export const expensesController = router;
export default router;
