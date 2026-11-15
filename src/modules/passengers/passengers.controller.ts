import { Router, Request } from "express";
import { PassengerModel } from "../../DB/module";
import { NotFoundException } from "../../common/exception";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import {
  classifyPassengerAgeOnTravelDate,
  parseEgyptianNationalId,
  PassengerRepository,
  passengerService,
} from "./passengers.service";
import { createPassengerValidator } from "./passengers.validation";

const router = Router({ caseSensitive: true, strict: true });

const PASSENGER_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.SALES,
  UserRole.OPERATIONS,
  UserRole.EMPLOYEE,
];

router.post(
  "/parse-national-id",
  authentication(),
  authorizeRoles(...PASSENGER_ROLES),
  responceFormatter(async (req: Request) => {
    const parsed = parseEgyptianNationalId(req.body.nationalId);
    const ageInfo = classifyPassengerAgeOnTravelDate(
      parsed.dateOfBirth,
      req.body.travelDate ? new Date(req.body.travelDate) : new Date(),
    );
    return { data: { ...parsed, ...ageInfo } };
  }),
);

router.get(
  "/",
  authentication(),
  authorizeRoles(...PASSENGER_ROLES),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));

    if (q.search) {
      const esc = q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { arabicName: { $regex: esc, $options: "i" } },
        { englishName: { $regex: esc, $options: "i" } },
        { nationalId: { $regex: esc, $options: "i" } },
        { passportNumber: { $regex: esc, $options: "i" } },
      ];
    }
    if (q.familyGroupCode) filter.familyGroupCode = q.familyGroupCode.toUpperCase();

    const repo = new PassengerRepository();
    const data = await repo.paginate({
      filter,
      options: { populate: [{ path: "mahramPassengerId", select: "arabicName englishName passportNumber" }] },
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 25,
    });
    return { data };
  }),
);

router.get(
  "/:id",
  authentication(),
  authorizeRoles(...PASSENGER_ROLES),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = { _id: req.params.id };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));
    const passenger = await PassengerModel.findOne(filter).populate("mahramPassengerId").lean();
    if (!passenger) throw new NotFoundException("Passenger not found");
    return { data: passenger };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(...PASSENGER_ROLES),
  validation(createPassengerValidator),
  responceFormatter(async (req: Request) => {
    const data = await passengerService.createPassenger(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.patch(
  "/:id",
  authentication(),
  authorizeRoles(...PASSENGER_ROLES),
  responceFormatter(async (req: Request) => {
    const data = await passengerService.updatePassenger(req.params.id as string, req.body, req);
    return { data };
  }),
);

export const passengersController = router;
export default router;
