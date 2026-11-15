import { Router, Request } from "express";
import { CashTransferModel } from "../../DB/module";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { UserRole } from "../../common/enum";
import { transferService } from "./transfers.service";
import { createTransferValidator } from "./transfers.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT),
  responceFormatter(async () => {
    const transfers = await CashTransferModel.find()
      .populate("fromCashboxId toCashboxId", "code nameAr nameEn")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return { data: transfers };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT),
  validation(createTransferValidator),
  responceFormatter(async (req: Request) => {
    const data = await transferService.createTransfer(req.validate.body, req);
    return { status: 201, data };
  }),
);

export const transfersController = router;
export default router;
