import { Router, Request } from "express";
import { BookingModel } from "../../DB/module";
import { NotFoundException } from "../../common/exception";
import {
  authentication,
  authorizeRoles,
  resolveScopedBranchFilter,
  responceFormatter,
  validation,
} from "../../middleware";
import { UserRole } from "../../common/enum";
import { BookingRepository, bookingService } from "./bookings.service";
import { createBookingValidator } from "./bookings.validation";

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
    UserRole.OPERATIONS,
    UserRole.EMPLOYEE,
  ),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, q.branchId, "branchId"));

    if (q.tripId) filter.tripId = q.tripId;
    if (q.status) filter.status = q.status;
    if (q.passengerId) filter.passengerId = q.passengerId;
    if (q.familyGroupCode) filter.familyGroupCode = q.familyGroupCode.toUpperCase();
    if (q.bookingNumber) filter.bookingNumber = q.bookingNumber.toUpperCase();

    const repo = new BookingRepository();
    const data = await repo.paginate({
      filter,
      options: {
        populate: [
          { path: "passengerId", select: "arabicName englishName nationalId passportNumber phone" },
          { path: "tripId", select: "code nameAr nameEn departureDate returnDate" },
          { path: "branchId", select: "code nameAr nameEn" },
        ],
        sort: { createdAt: -1 },
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
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.ACCOUNTANT,
    UserRole.SALES,
    UserRole.OPERATIONS,
    UserRole.EMPLOYEE,
  ),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = { _id: req.params.id };
    Object.assign(filter, resolveScopedBranchFilter(req.branchContext, undefined, "branchId"));
    const booking = await BookingModel.findOne(filter)
      .populate("passengerId")
      .populate("tripId")
      .populate("branchId", "code nameAr nameEn")
      .populate("mahramPassengerId", "arabicName englishName passportNumber")
      .lean();
    if (!booking) throw new NotFoundException("Booking not found");
    return { data: booking };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.SALES,
    UserRole.OPERATIONS,
    UserRole.EMPLOYEE,
  ),
  validation(createBookingValidator),
  responceFormatter(async (req: Request) => {
    const data = await bookingService.createBooking(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.post(
  "/:id/confirm",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await bookingService.confirmBooking(req.params.id as string, req);
    return { data };
  }),
);

router.post(
  "/:id/cancel",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await bookingService.cancelBooking(
      req.params.id as string,
      req.body?.reason || "Cancelled by staff",
      req,
    );
    return { data };
  }),
);

router.patch(
  "/:id",
  authentication(),
  authorizeRoles(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.SALES,
    UserRole.OPERATIONS,
    UserRole.EMPLOYEE,
  ),
  responceFormatter(async (req: Request) => {
    const data = await bookingService.updateOrTransferBooking(req.params.id as string, req.body, req);
    return { data };
  }),
);

export const bookingsController = router;
export default router;
