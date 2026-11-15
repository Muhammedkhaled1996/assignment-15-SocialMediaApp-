"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotelsController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const hotels_service_1 = require("./hotels.service");
const hotels_validation_1 = require("./hotels.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = {};
    if (req.query.city)
        filter.city = req.query.city;
    const hotels = await module_1.HotelModel.find(filter).sort({ city: 1, stars: -1 }).lean();
    return { data: hotels };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(hotels_validation_1.createHotelValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await hotels_service_1.hotelService.createHotel(req.validate.body, req);
    return { status: 201, data };
}));
router.get("/contracts", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    if (q.city)
        filter.city = q.city;
    if (q.hotelId)
        filter.hotelId = q.hotelId;
    if (q.supplierId)
        filter.supplierId = q.supplierId;
    if (q.status)
        filter.status = q.status;
    const repo = new hotels_service_1.HotelContractRepository();
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
}));
router.post("/contracts", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(hotels_validation_1.createHotelContractValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await hotels_service_1.hotelService.createHotelContract(req.validate.body, req);
    return { status: 201, data };
}));
router.patch("/contracts/:id/amend", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await hotels_service_1.hotelService.amendHotelContract(req.params.id, req.body, req);
    return { data };
}));
exports.hotelsController = router;
exports.default = router;
