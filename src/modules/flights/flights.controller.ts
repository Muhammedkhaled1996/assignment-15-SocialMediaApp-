import { Router, Request } from "express";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { UserRole } from "../../common/enum";
import { flightService } from "./flights.service";
import { createFlightValidator } from "./flights.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await flightService.listFlightLots(req.query as Record<string, string>);
    return { data };
  }),
);

router.get(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await flightService.getFlightLotById(req.params.id as string);
    return { data };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  validation(createFlightValidator),
  responceFormatter(async (req: Request) => {
    const data = await flightService.createFlightLot(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.patch(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await flightService.updateFlightLot(req.params.id as string, req.body, req);
    return { data };
  }),
);

router.patch(
  "/:id/archive",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await flightService.archiveFlightLot(req.params.id as string, req);
    return { data };
  }),
);

export const flightsController = router;
export default router;
