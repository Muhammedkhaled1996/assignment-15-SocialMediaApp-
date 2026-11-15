"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripService = exports.TripService = exports.TripRepository = void 0;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
class TripRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.TripModel);
    }
}
exports.TripRepository = TripRepository;
class TripService {
    repo = new TripRepository();
    async createTrip(payload, req) {
        const depDate = new Date(payload.departureDate);
        const retDate = new Date(payload.returnDate);
        if (retDate < depDate) {
            throw new exception_1.BadRequestException("Return date cannot be earlier than departure date");
        }
        return await (0, utils_1.withTransaction)(async (session) => {
            const code = payload.code?.toUpperCase().trim() ||
                (await service_1.sequenceService.nextReference({
                    documentType: "TRIP",
                    prefix: "TRP",
                    session,
                }));
            const exists = await module_1.TripModel.findOne({ code }, null, session ? { session } : undefined);
            if (exists) {
                throw new exception_1.ConflictException(`Trip with code ${code} already exists`);
            }
            if (Array.isArray(payload.flightAllocations) && payload.flightAllocations.length > 0) {
                for (const alloc of payload.flightAllocations) {
                    const updatedLot = await module_1.FlightLotModel.findOneAndUpdate({
                        _id: alloc.flightLotId,
                        status: "ACTIVE",
                        availableSeats: { $gte: alloc.allocatedSeats },
                    }, {
                        $inc: {
                            availableSeats: -alloc.allocatedSeats,
                            reservedSeats: alloc.allocatedSeats,
                        },
                    }, { returnDocument: "after", ...(session ? { session } : {}) });
                    if (!updatedLot) {
                        throw new exception_1.InsufficientInventoryError(`Flight lot ${alloc.flightLotId} does not have ${alloc.allocatedSeats} available seats`);
                    }
                }
            }
            const capacity = Number(payload.capacity);
            const [trip] = await module_1.TripModel.create([
                {
                    ...payload,
                    code,
                    departureDate: depDate,
                    returnDate: retDate,
                    capacity,
                    availableInventory: capacity,
                    allocatedToBranchesSeats: 0,
                    wholesaleAllocatedSeats: 0,
                    reservedSeats: 0,
                    confirmedSoldSeats: 0,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "TRIP_CREATED",
                module: "trips",
                entityType: "Trip",
                entityId: trip._id.toString(),
                newValues: trip.toObject(),
                session,
            });
            return trip;
        });
    }
    async createGroup(payload, req) {
        const trip = await module_1.TripModel.findById(payload.tripId);
        if (!trip)
            throw new exception_1.NotFoundException("Trip not found");
        const code = payload.code.toUpperCase().trim();
        const exists = await module_1.GroupModel.findOne({ code });
        if (exists)
            throw new exception_1.ConflictException(`Group ${code} already exists`);
        const group = await module_1.GroupModel.create({
            ...payload,
            code,
            createdBy: req.user?._id,
        });
        await service_1.auditService.record({
            req,
            action: "GROUP_CREATED",
            module: "trips",
            entityType: "Group",
            entityId: group._id.toString(),
            newValues: group.toObject(),
        });
        return group;
    }
}
exports.TripService = TripService;
exports.tripService = new TripService();
