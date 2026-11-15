import { Router, Request } from "express";
import { ReceiptModel } from "../../DB/module";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import { receiptService } from "./receipts.service";
import { createReceiptValidator } from "./receipts.validation";

const router = Router({ caseSensitive: true, strict: true });

const RECEIPT_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.ACCOUNTANT,
  UserRole.SALES,
  UserRole.EMPLOYEE,
];

router.get(
  "/",
  authentication(),
  authorizeRoles(...RECEIPT_ROLES),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));
    if (q.bookingId) filter.bookingId = q.bookingId;
    if (q.tripId) filter.tripId = q.tripId;
    if (q.receiptType) filter.receiptType = q.receiptType;

    const receipts = await ReceiptModel.find(filter)
      .populate("bookingId", "bookingNumber netSellingPrice amountPaid remainingBalance")
      .populate("passengerId", "arabicName englishName passportNumber")
      .populate("cashboxId", "code nameAr nameEn")
      .sort({ createdAt: -1 })
      .limit(Number(q.limit) || 50)
      .lean();
    return { data: receipts };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(...RECEIPT_ROLES),
  validation(createReceiptValidator),
  responceFormatter(async (req: Request) => {
    const data = await receiptService.createReceipt(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.post(
  "/refund",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.ACCOUNTANT),
  responceFormatter(async (req: Request) => {
    const data = await receiptService.createRefundVoucher(req.body, req);
    return { status: 201, data };
  }),
);

export const receiptsController = router;
export default router;
