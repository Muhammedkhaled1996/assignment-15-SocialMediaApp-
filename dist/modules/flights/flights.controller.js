"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flightsController = void 0;
const express_1 = require("express");
const middleware_1 = require("../../middleware");
const enum_1 = require("../../common/enum");
const flights_service_1 = require("./flights.service");
const flights_validation_1 = require("./flights.validation");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.get("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await flights_service_1.flightService.listFlightLots(req.query);
    return { data };
}));
router.get("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.ACCOUNTANT, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await flights_service_1.flightService.getFlightLotById(req.params.id);
    return { data };
}));
router.post("/", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.validation)(flights_validation_1.createFlightValidator), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await flights_service_1.flightService.createFlightLot(req.validate.body, req);
    return { status: 201, data };
}));
router.patch("/:id", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await flights_service_1.flightService.updateFlightLot(req.params.id, req.body, req);
    return { data };
}));
router.patch("/:id/archive", (0, middleware_1.authentication)(), (0, middleware_1.authorizeRoles)(enum_1.UserRole.SUPER_ADMIN, enum_1.UserRole.ADMIN, enum_1.UserRole.PROCUREMENT, enum_1.UserRole.OPERATIONS), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await flights_service_1.flightService.archiveFlightLot(req.params.id, req);
    return { data };
}));
exports.flightsController = router;
exports.default = router;
