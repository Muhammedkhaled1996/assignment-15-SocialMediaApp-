"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hotelService = exports.HotelService = exports.HotelContractRepository = void 0;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
const suppliers_1 = require("../suppliers");
class HotelContractRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.HotelContractModel);
    }
}
exports.HotelContractRepository = HotelContractRepository;
class HotelService {
    contractRepo = new HotelContractRepository();
    calculateHotelContractPricing(input) {
        const nights = Math.floor(input.nights);
        if (nights < 1) {
            throw new exception_1.BadRequestException("Hotel stay nights must be at least 1");
        }
        const singleRooms = Math.max(0, Math.floor(input.singleRooms || 0));
        const doubleRooms = Math.max(0, Math.floor(input.doubleRooms || 0));
        const tripleRooms = Math.max(0, Math.floor(input.tripleRooms || 0));
        const quadRooms = Math.max(0, Math.floor(input.quadRooms || 0));
        const totalRooms = singleRooms + doubleRooms + tripleRooms + quadRooms;
        const totalBeds = singleRooms * 1 + doubleRooms * 2 + tripleRooms * 3 + quadRooms * 4;
        if (totalRooms < 1) {
            throw new exception_1.BadRequestException("Hotel contract must include at least 1 room");
        }
        let singleRoomRatePerNight = 0;
        let doubleRoomRatePerNight = 0;
        let tripleRoomRatePerNight = 0;
        let quadRoomRatePerNight = 0;
        let flatRoomRatePerNight;
        if (input.pricingMode === "FLAT_RATE") {
            if (input.flatRoomRatePerNight === undefined || input.flatRoomRatePerNight <= 0) {
                throw new exception_1.BadRequestException("flatRoomRatePerNight must be > 0 for FLAT_RATE pricing mode");
            }
            flatRoomRatePerNight = utils_1.Money.round(input.flatRoomRatePerNight);
            singleRoomRatePerNight = flatRoomRatePerNight;
            doubleRoomRatePerNight = flatRoomRatePerNight;
            tripleRoomRatePerNight = flatRoomRatePerNight;
            quadRoomRatePerNight = flatRoomRatePerNight;
        }
        else {
            singleRoomRatePerNight = utils_1.Money.round(input.singleRoomRatePerNight ?? 0);
            doubleRoomRatePerNight = utils_1.Money.round(input.doubleRoomRatePerNight ?? 0);
            tripleRoomRatePerNight = utils_1.Money.round(input.tripleRoomRatePerNight ?? 0);
            quadRoomRatePerNight = utils_1.Money.round(input.quadRoomRatePerNight ?? 0);
            if ((singleRooms > 0 && singleRoomRatePerNight <= 0) ||
                (doubleRooms > 0 && doubleRoomRatePerNight <= 0) ||
                (tripleRooms > 0 && tripleRoomRatePerNight <= 0) ||
                (quadRooms > 0 && quadRoomRatePerNight <= 0)) {
                throw new exception_1.BadRequestException("Positive room rate per night is required for each contracted room type in TIERED_RATE mode");
            }
        }
        const singlePerPersonPerNight = singleRoomRatePerNight;
        const doublePerPersonPerNight = utils_1.Money.divide(doubleRoomRatePerNight, 2);
        const triplePerPersonPerNight = utils_1.Money.divide(tripleRoomRatePerNight, 3);
        const quadPerPersonPerNight = utils_1.Money.divide(quadRoomRatePerNight, 4);
        const singleRoomStayCost = utils_1.Money.multiply(singleRoomRatePerNight, nights);
        const doubleRoomStayCost = utils_1.Money.multiply(doubleRoomRatePerNight, nights);
        const tripleRoomStayCost = utils_1.Money.multiply(tripleRoomRatePerNight, nights);
        const quadRoomStayCost = utils_1.Money.multiply(quadRoomRatePerNight, nights);
        const singlePerPersonStayRate = singleRoomStayCost;
        const doublePerPersonStayRate = utils_1.Money.divide(doubleRoomStayCost, 2);
        const triplePerPersonStayRate = utils_1.Money.divide(tripleRoomStayCost, 3);
        const quadPerPersonStayRate = utils_1.Money.divide(quadRoomStayCost, 4);
        const contractValue = utils_1.Money.add(utils_1.Money.multiply(singleRoomStayCost, singleRooms), utils_1.Money.multiply(doubleRoomStayCost, doubleRooms), utils_1.Money.multiply(tripleRoomStayCost, tripleRooms), utils_1.Money.multiply(quadRoomStayCost, quadRooms));
        return {
            roomCapacities: {
                ...(input.singleRooms !== undefined ? { singleRooms } : {}),
                doubleRooms,
                tripleRooms,
                quadRooms,
                totalRooms,
                totalBeds,
            },
            rates: {
                flatRoomRatePerNight,
                ...(input.singleRoomRatePerNight !== undefined ? { singleRoomRatePerNight, singlePerPersonPerNight, singlePerPersonStayRate } : {}),
                doubleRoomRatePerNight,
                tripleRoomRatePerNight,
                quadRoomRatePerNight,
                doublePerPersonPerNight,
                triplePerPersonPerNight,
                quadPerPersonPerNight,
                doublePerPersonStayRate,
                triplePerPersonStayRate,
                quadPerPersonStayRate,
            },
            contractValue,
        };
    }
    async createHotel(payload, req) {
        const city = String(payload.city || "").toUpperCase().trim();
        const defaultCountry = city === "MAKKAH" || city === "MADINAH" ? "SA" : "EG";
        const hotel = await module_1.HotelModel.create({
            ...payload,
            city,
            country: (payload.country || defaultCountry).toUpperCase().trim(),
            createdBy: req.user?._id,
        });
        await service_1.auditService.record({
            req,
            action: "HOTEL_CREATED",
            module: "hotels",
            entityType: "Hotel",
            entityId: hotel._id.toString(),
            newValues: hotel.toObject(),
        });
        return hotel;
    }
    async createHotelContract(payload, req) {
        const hotel = await module_1.HotelModel.findById(payload.hotelId);
        if (!hotel) {
            throw new exception_1.NotFoundException("Hotel not found");
        }
        const checkIn = new Date(payload.checkIn);
        const checkOut = new Date(payload.checkOut);
        if (checkOut <= checkIn) {
            throw new exception_1.BadRequestException("checkOut date must be after checkIn date");
        }
        const diffNights = Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
        const nights = payload.nights ? Number(payload.nights) : diffNights;
        const calculated = this.calculateHotelContractPricing({
            pricingMode: payload.pricingMode,
            nights,
            singleRooms: payload.roomCapacities.singleRooms,
            doubleRooms: payload.roomCapacities.doubleRooms,
            tripleRooms: payload.roomCapacities.tripleRooms,
            quadRooms: payload.roomCapacities.quadRooms,
            flatRoomRatePerNight: payload.rates?.flatRoomRatePerNight,
            singleRoomRatePerNight: payload.rates?.singleRoomRatePerNight,
            doubleRoomRatePerNight: payload.rates?.doubleRoomRatePerNight,
            tripleRoomRatePerNight: payload.rates?.tripleRoomRatePerNight,
            quadRoomRatePerNight: payload.rates?.quadRoomRatePerNight,
        });
        return await (0, utils_1.withTransaction)(async (session) => {
            const contractNumber = payload.contractNumber?.toUpperCase().trim() ||
                (await service_1.sequenceService.nextReference({
                    documentType: "CONTRACT",
                    prefix: "HTL",
                    session,
                }));
            const exists = await module_1.HotelContractModel.findOne({ contractNumber }, null, session ? { session } : undefined);
            if (exists) {
                throw new exception_1.ConflictException(`Hotel contract ${contractNumber} already exists`);
            }
            const [contract] = await module_1.HotelContractModel.create([
                {
                    contractNumber,
                    hotelId: hotel._id,
                    supplierId: payload.supplierId,
                    city: (payload.city || hotel.city).toUpperCase().trim(),
                    checkIn,
                    checkOut,
                    nights,
                    roomCapacities: calculated.roomCapacities,
                    allocatedRooms: { singleRooms: 0, doubleRooms: 0, tripleRooms: 0, quadRooms: 0 },
                    pricingMode: payload.pricingMode,
                    currency: payload.currency || "SAR",
                    rates: calculated.rates,
                    contractValue: calculated.contractValue,
                    paidAmount: 0,
                    remainingLiability: calculated.contractValue,
                    paymentTerms: payload.paymentTerms,
                    dueDate: payload.dueDate ? new Date(payload.dueDate) : checkIn,
                    amendments: [],
                    attachments: payload.attachments || [],
                    status: "ACTIVE",
                    notes: payload.notes,
                    createdBy: req.user?._id,
                },
            ], session ? { session } : undefined);
            await suppliers_1.supplierService.recordLedgerMovement({
                supplierId: payload.supplierId,
                branchId: req.branchContext?.activeBranchId,
                entryType: "CONTRACT_OBLIGATION",
                referenceType: "HOTEL_CONTRACT",
                referenceId: contract._id,
                referenceNumber: contractNumber,
                description: `Hotel Contract ${contractNumber} (${hotel.nameEn} - ${hotel.city}, ${nights} nights)`,
                creditAmount: calculated.contractValue,
                exchangeRateToEgp: payload.exchangeRateToEgp || 1,
                dueDate: payload.dueDate ? new Date(payload.dueDate) : checkIn,
                actorId: req.user?._id,
                session,
            });
            await service_1.auditService.record({
                req,
                action: "HOTEL_CONTRACT_CREATED",
                module: "hotels",
                entityType: "HotelContract",
                entityId: contract._id.toString(),
                newValues: contract.toObject(),
                session,
            });
            return contract;
        });
    }
    async amendHotelContract(contractId, payload, req) {
        return await (0, utils_1.withTransaction)(async (session) => {
            const contract = await module_1.HotelContractModel.findById(contractId, null, session ? { session } : undefined);
            if (!contract)
                throw new exception_1.NotFoundException("Hotel contract not found");
            const previousSnapshot = contract.toObject();
            const previousValue = contract.contractValue;
            const nights = payload.nights ?? contract.nights;
            const pricingMode = payload.pricingMode ?? contract.pricingMode;
            const singleRooms = payload.roomCapacities?.singleRooms ?? contract.roomCapacities.singleRooms;
            const doubleRooms = payload.roomCapacities?.doubleRooms ?? contract.roomCapacities.doubleRooms;
            const tripleRooms = payload.roomCapacities?.tripleRooms ?? contract.roomCapacities.tripleRooms;
            const quadRooms = payload.roomCapacities?.quadRooms ?? contract.roomCapacities.quadRooms;
            const calculated = this.calculateHotelContractPricing({
                pricingMode,
                nights,
                singleRooms,
                doubleRooms,
                tripleRooms,
                quadRooms,
                flatRoomRatePerNight: payload.rates?.flatRoomRatePerNight ?? contract.rates.flatRoomRatePerNight,
                singleRoomRatePerNight: payload.rates?.singleRoomRatePerNight ?? contract.rates.singleRoomRatePerNight,
                doubleRoomRatePerNight: payload.rates?.doubleRoomRatePerNight ?? contract.rates.doubleRoomRatePerNight,
                tripleRoomRatePerNight: payload.rates?.tripleRoomRatePerNight ?? contract.rates.tripleRoomRatePerNight,
                quadRoomRatePerNight: payload.rates?.quadRoomRatePerNight ?? contract.rates.quadRoomRatePerNight,
            });
            const deltaValue = utils_1.Money.subtract(calculated.contractValue, previousValue);
            contract.nights = nights;
            contract.pricingMode = pricingMode;
            contract.roomCapacities = calculated.roomCapacities;
            contract.rates = calculated.rates;
            contract.contractValue = calculated.contractValue;
            contract.remainingLiability = Math.max(0, utils_1.Money.subtract(calculated.contractValue, contract.paidAmount));
            contract.status = "AMENDED";
            contract.updatedBy = req.user?._id;
            contract.amendments.push({
                amendedAt: new Date(),
                amendedBy: req.user?._id,
                reason: payload.reason || "Contract amendment",
                previousValue,
                newValue: calculated.contractValue,
            });
            await contract.save(session ? { session } : undefined);
            if (deltaValue !== 0) {
                await suppliers_1.supplierService.recordLedgerMovement({
                    supplierId: contract.supplierId,
                    branchId: req.branchContext?.activeBranchId,
                    entryType: deltaValue > 0 ? "ADJUSTMENT" : "CREDIT_NOTE",
                    referenceType: "HOTEL_CONTRACT",
                    referenceId: contract._id,
                    referenceNumber: contract.contractNumber,
                    description: `Amendment on Hotel Contract ${contract.contractNumber}: ${payload.reason || "Value updated"}`,
                    creditAmount: deltaValue > 0 ? deltaValue : 0,
                    debitAmount: deltaValue < 0 ? Math.abs(deltaValue) : 0,
                    exchangeRateToEgp: payload.exchangeRateToEgp || 1,
                    actorId: req.user?._id,
                    session,
                });
            }
            await service_1.auditService.record({
                req,
                action: "HOTEL_CONTRACT_AMENDED",
                module: "hotels",
                entityType: "HotelContract",
                entityId: contract._id.toString(),
                previousValues: previousSnapshot,
                newValues: contract.toObject(),
                session,
            });
            return contract;
        });
    }
}
exports.HotelService = HotelService;
exports.hotelService = new HotelService();
