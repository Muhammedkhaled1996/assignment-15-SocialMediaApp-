"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passengersController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const passengers_service_1 = require("./passengers.service");
const passengers_validation_1 = require("./passengers.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
const PASSENGER_ROLES = [
    enum_1.UserRole.SUPER_ADMIN,
    enum_1.UserRole.ADMIN,
    enum_1.UserRole.BRANCH_MANAGER,
    enum_1.UserRole.SALES,
    enum_1.UserRole.OPERATIONS,
    enum_1.UserRole.EMPLOYEE,
];
router.post("/parse-national-id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...PASSENGER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const parsed = (0, passengers_service_1.parseEgyptianNationalId)(req.body.nationalId);
    const ageInfo = (0, passengers_service_1.classifyPassengerAgeOnTravelDate)(parsed.dateOfBirth, req.body.travelDate ? new Date(req.body.travelDate) : new Date());
    return { data: { ...parsed, ...ageInfo } };
}));
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...PASSENGER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    if (q.search) {
        const esc = q.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$or = [
            { arabicName: { $regex: esc, $options: "i" } },
            { englishName: { $regex: esc, $options: "i" } },
            { nationalId: { $regex: esc, $options: "i" } },
            { passportNumber: { $regex: esc, $options: "i" } },
        ];
    }
    if (q.familyGroupCode)
        filter.familyGroupCode = q.familyGroupCode.toUpperCase();
    const repo = new passengers_service_1.PassengerRepository();
    const data = await repo.paginate({
        filter,
        options: { populate: [{ path: "mahramPassengerId", select: "arabicName englishName passportNumber" }] },
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 25,
    });
    return { data };
}));
router.get("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...PASSENGER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = { _id: req.params.id };
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
    const passenger = await module_1.PassengerModel.findOne(filter).populate("mahramPassengerId").lean();
    if (!passenger)
        throw new exception_1.NotFoundException("Passenger not found");
    return { data: passenger };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...PASSENGER_ROLES), (0, middleware_1.validation)(passengers_validation_1.createPassengerValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await passengers_service_1.passengerService.createPassenger(req.validate.body, req);
    return { status: 201, data };
}));
router.patch("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(...PASSENGER_ROLES), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await passengers_service_1.passengerService.updatePassenger(req.params.id, req.body, req);
    return { data };
}));
exports.passengersController = router;
exports.default = router;
