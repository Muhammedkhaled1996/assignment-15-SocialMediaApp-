import { Router, Request } from "express";
import { HotelModel } from "../../DB/module";
import { authentication, authorizeRoles, responceFormatter, validation } from "../../middleware";
import { UserRole } from "../../common/enum";
import { HotelContractRepository, hotelService } from "./hotels.service";
import { createHotelContractValidator, createHotelValidator } from "./hotels.validation";

const router = Router({ caseSensitive: true, strict: true });

router.get(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const filter: Record<string, any> = {};
    if (req.query.city) filter.city = req.query.city;
    const hotels = await HotelModel.find(filter).sort({ city: 1, stars: -1 }).lean();
    return { data: hotels };
  }),
);

router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  validation(createHotelValidator),
  responceFormatter(async (req: Request) => {
    const data = await hotelService.createHotel(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.get(
  "/contracts",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const q = req.query as Record<string, string>;
    const filter: Record<string, any> = {};
    if (q.city) filter.city = q.city;
    if (q.hotelId) filter.hotelId = q.hotelId;
    if (q.supplierId) filter.supplierId = q.supplierId;
    if (q.status) filter.status = q.status;
    const repo = new HotelContractRepository();
    const data = await repo.paginate({
      filter,
      options: {
        populate: [
          { path: "hotelId", select: "nameAr nameEn city stars" },
          { path: "supplierId", select: "code nameAr nameEn" },
        ],
        sort: { checkIn: 1 },
      },
      page: Number(q.page) || 1,
      limit: Number(q.limit) || 25,
    });
    return { data };
  }),
);

router.post(
  "/contracts",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  validation(createHotelContractValidator),
  responceFormatter(async (req: Request) => {
    const data = await hotelService.createHotelContract(req.validate.body, req);
    return { status: 201, data };
  }),
);

router.patch(
  "/contracts/:id/amend",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.OPERATIONS),
  responceFormatter(async (req: Request) => {
    const data = await hotelService.amendHotelContract(req.params.id as string, req.body, req);
    return { data };
  }),
);

export const hotelsController = router;
export default router;
