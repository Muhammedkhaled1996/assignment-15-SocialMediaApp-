"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripsController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const trips_service_1 = require("./trips.service");
const trips_validation_1 = require("./trips.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    if (q.season)
        filter.season = q.season;
    if (q.status)
        filter.status = q.status;
    if (q.quotaMode)
        filter.quotaMode = q.quotaMode;
    if (q.tripCategory)
        filter.tripCategory = q.tripCategory;
    if (q.destination)
        filter.destination = q.destination;
    if (q.transportType)
        filter.transportType = q.transportType;
    if (q.search) {
        const searchRegex = { $regex: q.search.trim(), $options: "i" };
        filter.$or = [
            { code: searchRegex },
            { nameAr: searchRegex },
            { nameEn: searchRegex },
            { destination: searchRegex },
        ];
    }
    const repo = new trips_service_1.TripRepository();
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
}));
router.get("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...enum_1.ALL_USER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const trip = await module_1.TripModel.findById(req.params.id)
        .populate("approvedPricingVersionId")
        .populate("flightAllocations.flightLotId")
        .populate("hotelAllocations.hotelContractId")
        .lean();
    if (!trip)
        throw new exception_1.NotFoundException("Trip not found");
    const groups = await module_1.GroupModel.find({ tripId: trip._id }).lean();
    return { data: { ...trip, groups } };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(trips_validation_1.createTripValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await trips_service_1.tripService.createTrip(req.validate.body, req);
    return { status: 201, data };
}));
router.patch("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const updated = await module_1.TripModel.findByIdAndUpdate(req.params.id, { ...req.body, updatedBy: req.user?._id }, { returnDocument: "after", runValidators: true });
    if (!updated)
        throw new exception_1.NotFoundException("Trip not found");
    return { data: updated };
}));
router.post("/groups", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(trips_validation_1.createGroupValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await trips_service_1.tripService.createGroup(req.validate.body, req);
    return { status: 201, data };
}));
exports.tripsController = router;
exports.default = router;
