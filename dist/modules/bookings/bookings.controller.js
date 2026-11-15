"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingsController = void 0;
const express_1 = require("express");
const module_1 = require("../../DB/module");
const exception_1 = require("../../common/exception");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const bookings_service_1 = require("./bookings.service");
const bookings_validation_1 = require("./bookings.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS, enum_1.UserRole.EMPLOYEE), (0, middleware_1.responceFormatter)(async (req) => {
    const q = req.query;
    const filter = {};
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, q.branchId, "branchId"));
    if (q.tripId)
        filter.tripId = q.tripId;
    if (q.status)
        filter.status = q.status;
    if (q.passengerId)
        filter.passengerId = q.passengerId;
    if (q.familyGroupCode)
        filter.familyGroupCode = q.familyGroupCode.toUpperCase();
    if (q.bookingNumber)
        filter.bookingNumber = q.bookingNumber.toUpperCase();
    const repo = new bookings_service_1.BookingRepository();
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
}));
router.get("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS, enum_1.UserRole.EMPLOYEE), (0, middleware_1.responceFormatter)(async (req) => {
    const filter = { _id: req.params.id };
    Object.assign(filter, (0, middleware_1.resolveScopedBranchFilter)(req.branchContext, undefined, "branchId"));
    const booking = await module_1.BookingModel.findOne(filter)
        .populate("passengerId")
        .populate("tripId")
        .populate("branchId", "code nameAr nameEn")
        .populate("mahramPassengerId", "arabicName englishName passportNumber")
        .lean();
    if (!booking)
        throw new exception_1.NotFoundException("Booking not found");
    return { data: booking };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS, enum_1.UserRole.EMPLOYEE), (0, middleware_1.validation)(bookings_validation_1.createBookingValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await bookings_service_1.bookingService.createBooking(req.validate.body, req);
    return { status: 201, data };
}));
router.post("/:id/confirm", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await bookings_service_1.bookingService.confirmBooking(req.params.id, req);
    return { data };
}));
router.post("/:id/cancel", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await bookings_service_1.bookingService.cancelBooking(req.params.id, req.body?.reason || "Cancelled by staff", req);
    return { data };
}));
router.patch("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.BRANCH_MANAGER, enum_1.UserRole.SALES, enum_1.UserRole.OPERATIONS, enum_1.UserRole.EMPLOYEE), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await bookings_service_1.bookingService.updateOrTransferBooking(req.params.id, req.body, req);
    return { data };
}));
exports.bookingsController = router;
exports.default = router;
