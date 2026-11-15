import { Router, Request } from "express";
import { BranchQuotaModel, InventoryMovementModel } from "../../DB/module";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import { quotaService } from "./quotas.service";
import { allocateValidator, transferValidator } from "./quotas.validation";

const router = Router({ caseSensitive: true, strict: true });

const QUOTA_READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.SALES,
  UserRole.OPERATIONS,
  UserRole.EMPLOYEE,
];

router.get(
  "/",
  authentication(),
  authorizeRoles(...QUOTA_READ_ROLES),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (q.tripId) filter.tripId = q.tripId;
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));

    const quotas = await BranchQuotaModel.find(filter)
      .populate("tripId", "code nameAr nameEn departureDate capacity availableInventory quotaMode")
      .populate("branchId", "code nameAr nameEn")
      .lean();
    return { data: quotas };
  }),
);

router.get(
  "/movements",
  authentication(),
  authorizeRoles(...QUOTA_READ_ROLES),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (q.tripId) filter.tripId = q.tripId;
    if (!req.branchContext?.isCentralAdmin) {
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));
    } else if (q.branchId) {
      filter.branchId = q.branchId;
    }
    const movements = await InventoryMovementModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(q.limit) || 100)
      .lean();
    return { data: movements };
  }),
);

router.post(
  "/allocate",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  validation(allocateValidator),
  responceFormatter(async (req: Request) => {
    const data = await quotaService.allocateToBranch({ ...req.validate.body, req });
    return { status: 201, data };
  }),
);

router.post(
  "/transfer",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  validation(transferValidator),
  responceFormatter(async (req: Request) => {
    const data = await quotaService.transferBetweenBranches({ ...req.validate.body, req });
    return { data };
  }),
);

router.post(
  "/release",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  validation(allocateValidator),
  responceFormatter(async (req: Request) => {
    const data = await quotaService.releaseFromBranch({ ...req.validate.body, req });
    return { data };
  }),
);

export const quotasController = router;
export default router;
