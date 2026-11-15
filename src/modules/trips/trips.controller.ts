import { Router, Request } from "express";
import { GroupModel, TripModel } from "../../DB/module";
import { NotFoundException } from "../../common/exception";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { ALL_USER_ROLES, UserRole } from "../../common/enum";
import { TripRepository, tripService } from "./trips.service";
import { createGroupValidator, createTripValidator } from "./trips.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (q.season) filter.season = q.season;
    if (q.status) filter.status = q.status;
    if (q.quotaMode) filter.quotaMode = q.quotaMode;
    if (q.tripCategory) filter.tripCategory = q.tripCategory;
    if (q.destination) filter.destination = q.destination;
    if (q.transportType) filter.transportType = q.transportType;
    if (q.search) {
      const searchRegex = { $regex: q.search.trim(), $options: "i" };
      filter.$or = [
        { code: searchRegex },
        { nameAr: searchRegex },
        { nameEn: searchRegex },
        { destination: searchRegex },
      ];
    }
    const repo = new TripRepository();
    const data = await repo.paginate({
      filter,
      options: {
        populate: [{ path: "approvedPricingVersionId" }],
        sort: { departureDate: 1 },
      },
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 25,
    });
    return { data };
  }),
);

router.get(
  "/:id",
  authentication(),
  authorizeRoles(...ALL_USER_ROLES),
  responceFormatter(async (req: Request) => {
    const trip = await TripModel.findById(req.params.id)
      .populate("approvedPricingVersionId")
      .populate("flightAllocations.flightLotId")
      .populate("hotelAllocations.hotelContractId")
      .lean();
    if (!trip) throw new NotFoundException("Trip not found");
    const groups = await GroupModel.find({ tripId: trip._id }).lean();
    return { data: { ...trip, groups } };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  validation(createTripValidator),
  responceFormatter(async (req: Request) => {
    const data = await tripService.createTrip(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.patch(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const updated = await TripModel.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user?._id },
      { returnDocument: "after", runValidators: true },
    );
    if (!updated) throw new NotFoundException("Trip not found");
    return { data: updated };
  }),
);

router.post(
  "/groups",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OPERATIONS),
  validation(createGroupValidator),
  responceFormatter(async (req: Request) => {
    const data = await tripService.createGroup(req.validate.body, req);
    return { status: 201, data };
  }),
);

export const tripsController = router;
export default router;
