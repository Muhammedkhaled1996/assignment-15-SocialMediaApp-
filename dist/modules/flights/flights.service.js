"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.flightService = exports.FlightService = exports.FlightLotRepository = void 0;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
const suppliers_1 = require("../suppliers");
class FlightLotRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.FlightLotModel);
    }
}
exports.FlightLotRepository = FlightLotRepository;
class FlightService {
    repo = new FlightLotRepository();
    async listFlightLots(query) {
        const filter = {};
        if (query.status)
            filter.status = query.status;
        if (query.airline)
            filter.airline = { $regex: query.airline, $options: "i" };
        if (query.supplierId)
            filter.supplierId = query.supplierId;
        if (query.purchaseSource)
            filter.purchaseSource = query.purchaseSource;
        return await this.repo.paginate({
            filter,
            options: { populate: [{ path: "supplierId", select: "code nameAr nameEn" }], sort: { departureDate: 1 } },
            page: Number(query.page) || 1,
            limit: Number(query.limit) || 25,
        });
    }
    async getFlightLotById(id) {
        const lot = await module_1.FlightLotModel.findById(id).populate("supplierId brokerId").lean();
        if (!lot)
            throw new exception_1.NotFoundException("Flight lot not found");
        return lot;
    }
    async createFlightLot(payload, req) {
        const depDate = new Date(payload.departureDate);
        const retDate = new Date(payload.returnDate);
        if (retDate < depDate) {
            throw new exception_1.BadRequestException("Return date cannot be earlier than departure date");
        }
        if (payload.purchaseSource === "BROKER" && !payload.brokerId) {
            throw new exception_1.BadRequestException("brokerId is required when purchaseSource is BROKER");
        }
        const seatQuantity = Number(payload.seatQuantity);
        const unitCost = utils_1.Money.round(payload.unitCost);
        const totalCost = utils_1.Money.multiply(unitCost, seatQuantity);
        return await (0, utils_1.withTransaction)(async (session) => {
            const contractReference = payload.contractReference?.toUpperCase().trim() ||
                (await service_1.sequenceService.nextReference({
                    documentType: "CONTRACT",
                    prefix: "FLT",
                    session,
                }));
            const exists = await module_1.FlightLotModel.findOne({ contractReference }, null, session ? { session } : undefined);
            if (exists) {
                throw new exception_1.ConflictException(`Flight contract reference ${contractReference} already exists`);
            }
            const [flightLot] = await module_1.FlightLotModel.create([
                {
                    ...payload,
                    contractReference,
                    departureDate: depDate,
                    returnDate: retDate,
                    seatQuantity,
                    availableSeats: seatQuantity,
                    reservedSeats: 0,
                    soldSeats: 0,
                    unitCost,
                    totalCost,
                    paidAmount: 0,
                    remainingLiability: totalCost,
                    status: "ACTIVE",
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            const targetLiabilitySupplierId = payload.purchaseSource === "BROKER" && payload.brokerId ? payload.brokerId : payload.supplierId;
            await suppliers_1.supplierService.recordLedgerMovement({
                supplierId: targetLiabilitySupplierId,
                branchId: req.branchContext?.activeBranchId,
                entryType: "CONTRACT_OBLIGATION",
                referenceType: "FLIGHT_LOT",
                referenceId: flightLot._id,
                referenceNumber: contractReference,
                description: `Flight Lot ${contractReference} (${payload.airline} ${payload.flightRoute}, ${seatQuantity} seats @ ${unitCost})`,
                creditAmount: totalCost,
                exchangeRateToEgp: payload.exchangeRateToEgp || 1,
                dueDate: payload.paymentSchedule?.[0]?.dueDate ? new Date(payload.paymentSchedule[0].dueDate) : depDate,
                actorId: req.user?._id,
                session,
            });
            await service_1.auditService.record({
                req,
                action: "FLIGHT_LOT_CREATED",
                module: "flights",
                entityType: "FlightLot",
                entityId: flightLot._id.toString(),
                newValues: flightLot.toObject(),
                session,
            });
            return flightLot;
        });
    }
    async updateFlightLot(id, payload, req) {
        const lot = await module_1.FlightLotModel.findById(id);
        if (!lot)
            throw new exception_1.NotFoundException("Flight lot not found");
        const prev = lot.toObject();
        if (payload.seatQuantity !== undefined) {
            const committedSeats = lot.reservedSeats + lot.soldSeats;
            if (payload.seatQuantity < committedSeats) {
                throw new exception_1.BadRequestException(`Cannot reduce seatQuantity (${payload.seatQuantity}) below already reserved/sold seats (${committedSeats})`);
            }
            lot.availableSeats = payload.seatQuantity - committedSeats;
            lot.seatQuantity = payload.seatQuantity;
        }
        if (payload.unitCost !== undefined) {
            lot.unitCost = utils_1.Money.round(payload.unitCost);
        }
        lot.totalCost = utils_1.Money.multiply(lot.unitCost, lot.seatQuantity);
        lot.remainingLiability = Math.max(0, utils_1.Money.subtract(lot.totalCost, lot.paidAmount));
        if (payload.airline)
            lot.airline = payload.airline;
        if (payload.flightRoute)
            lot.flightRoute = payload.flightRoute;
        if (payload.departureDate)
            lot.departureDate = new Date(payload.departureDate);
        if (payload.returnDate)
            lot.returnDate = new Date(payload.returnDate);
        if (payload.paymentTerms !== undefined)
            lot.paymentTerms = payload.paymentTerms;
        if (payload.notes !== undefined)
            lot.notes = payload.notes;
        if (payload.status)
            lot.status = payload.status;
        lot.updatedBy = req.user?._id;
        await lot.save();
        await service_1.auditService.record({
            req,
            action: "FLIGHT_LOT_UPDATED",
            module: "flights",
            entityType: "FlightLot",
            entityId: lot._id.toString(),
            previousValues: prev,
            newValues: lot.toObject(),
        });
        return lot;
    }
    async archiveFlightLot(id, req) {
        const lot = await module_1.FlightLotModel.findById(id);
        if (!lot)
            throw new exception_1.NotFoundException("Flight lot not found");
        if (lot.reservedSeats > 0) {
            throw new exception_1.ConflictException("Cannot archive flight lot while seats are actively reserved");
        }
        const prev = lot.toObject();
        lot.status = "ARCHIVED";
        lot.updatedBy = req.user?._id;
        await lot.save();
        await service_1.auditService.record({
            req,
            action: "FLIGHT_LOT_ARCHIVED",
            module: "flights",
            entityType: "FlightLot",
            entityId: lot._id.toString(),
            previousValues: prev,
            newValues: lot.toObject(),
        });
        return lot;
    }
}
exports.FlightService = FlightService;
exports.flightService = new FlightService();
exports.default = exports.flightService;
