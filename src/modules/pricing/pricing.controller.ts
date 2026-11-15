import { Router, Request } from "express";
import { BadRequestException } from "../../common/exception";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { UserRole } from "../../common/enum";
import { PricingVersionRepository, pricingService } from "./pricing.service";
import { pricingScenarioValidator } from "./pricing.validation";

const router = Router({ caseSensitive: true, strict: true });

router.post(
  "/simulate",
  authentication(),
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.SALES,
    UserRole.PROCUREMENT,
    UserRole.OPERATIONS,
  ),
  validation(pricingScenarioValidator),
  responceFormatter(async (req: Request) => {
    const data = pricingService.calculateScenario(req.validate.body);
    return { data };
  }),
);

router.get(
  "/",
  authentication(),
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.SALES,
    UserRole.PROCUREMENT,
    UserRole.OPERATIONS,
  ),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (q.tripId) filter.tripId = q.tripId;
    if (q.status) filter.status = q.status;
    const repo = new PricingVersionRepository();
    const data = await repo.paginate({
      filter,
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 25,
    });
    return { data };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  validation(pricingScenarioValidator),
  responceFormatter(async (req: Request) => {
    if (!req.validate.body.code || !req.validate.body.name) {
      throw new BadRequestException("code and name are required to persist a pricing version");
    }
    const data = await pricingService.createPricingVersion(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.patch(
  "/:id/approve",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await pricingService.approvePricingVersion(req.params.id as string, req);
    return { data };
  }),
);

export const pricingController = router;
export default router;
