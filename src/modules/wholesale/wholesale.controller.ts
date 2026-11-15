import { Router, Request } from "express";
import { WholesaleContractModel, WholesalePartnerModel } from "../../DB/module";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import { wholesaleService } from "./wholesale.service";
import { createContractValidator, createPartnerValidator } from "./wholesale.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/partners",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SALES, UserRole.OPERATIONS),
  responceFormatter(async () => {
    const partners = await WholesalePartnerModel.find().sort({ companyNameEn: 1 }).lean();
    return { data: partners };
  }),
);

router.post(
  "/partners",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS),
  validation(createPartnerValidator),
  responceFormatter(async (req: Request) => {
    const data = await wholesaleService.createPartner(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.get(
  "/contracts",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.SALES, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = {};
    if (!req.branchContext?.isCentralAdmin) {
      Object.assign(filter, resolveScopedBranchFilter(req.branchContext, req.query.branchId as string, "branchId"));
    }
    if (req.query.tripId) filter.tripId = req.query.tripId;
    if (req.query.partnerId) filter.partnerId = req.query.partnerId;
    const contracts = await WholesaleContractModel.find(filter)
      .populate("partnerId", "code companyNameAr companyNameEn")
      .populate("tripId", "code nameAr nameEn departureDate")
      .sort({ createdAt: -1 })
      .lean();
    return { data: contracts };
  }),
);

router.post(
  "/contracts",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS),
  validation(createContractValidator),
  responceFormatter(async (req: Request) => {
    const data = await wholesaleService.createWholesaleContract(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.post(
  "/contracts/:id/release-seats",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await wholesaleService.releaseWholesaleSeats(
      req.params.id as string,
      Number(req.body.quantity),
      req,
    );
    return { data };
  }),
);

export const wholesaleController = router;
export default router;
