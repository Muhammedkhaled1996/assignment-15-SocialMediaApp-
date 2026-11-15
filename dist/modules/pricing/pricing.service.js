"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingService = exports.PricingService = exports.PricingVersionRepository = void 0;
const module_1 = require("../../DB/module");
const base_repository_1 = require("../../common/repository/base.repository");
const exception_1 = require("../../common/exception");
const service_1 = require("../../common/service");
const utils_1 = require("../../common/utils");
class PricingVersionRepository extends base_repository_1.DatabaseRepository {
    constructor() {
        super(module_1.PricingVersionModel);
    }
}
exports.PricingVersionRepository = PricingVersionRepository;
class PricingService {
    calculateScenario(params) {
        const rate = utils_1.Money.roundRate(params.exchangeRateSarToEgp);
        const capacity = Math.floor(params.groupCapacity);
        if (rate <= 0)
            throw new exception_1.BadRequestException("Exchange rate SAR/EGP must be positive");
        if (capacity < 1)
            throw new exception_1.BadRequestException("Group capacity must be at least 1");
        const inp = params.inputs;
        const flightCostAdultEgp = utils_1.Money.round(inp.flightCostPerSeatEgp);
        const supervisorAccommEgp = utils_1.Money.convert(inp.supervisorAccommodationSar || 0, rate);
        const totalSupervisorCostEgp = utils_1.Money.add(inp.supervisorFlightTicketEgp || 0, supervisorAccommEgp, inp.supervisorGratuitiesEgp || 0);
        const supervisorCostPerPassengerEgp = utils_1.Money.divide(totalSupervisorCostEgp, capacity);
        const saudiAndTransportSar = utils_1.Money.add(inp.saudiAgentFeeSar || 0, inp.transportCostSar || 0);
        const saudiAndTransportEgp = utils_1.Money.convert(saudiAndTransportSar, rate);
        const operationalCostAdultEgp = utils_1.Money.add(saudiAndTransportEgp, inp.barcodeFeeEgp || 0, inp.giftsCostEgp || 0, inp.otherOperationalCostEgp || 0);
        const marginFactor = 1 + (inp.targetProfitMarginPercent || 0) / 100;
        const minPriceFactor = 1 - (inp.maxDiscountPercentAllowed || 0) / 100;
        const buildAdultCategory = (category, makkahSar, madinahSar) => {
            const accommodationCostSar = utils_1.Money.add(makkahSar, madinahSar);
            const accommodationCostEgp = utils_1.Money.convert(accommodationCostSar, rate);
            const totalCostPerPassengerEgp = utils_1.Money.add(flightCostAdultEgp, accommodationCostEgp, operationalCostAdultEgp, supervisorCostPerPassengerEgp);
            const sellingPriceEgp = utils_1.Money.multiply(totalCostPerPassengerEgp, marginFactor);
            const minimumSellingPriceEgp = Math.max(totalCostPerPassengerEgp, utils_1.Money.multiply(sellingPriceEgp, minPriceFactor));
            const profitPerPassengerEgp = utils_1.Money.subtract(sellingPriceEgp, totalCostPerPassengerEgp);
            const profitMarginPercent = totalCostPerPassengerEgp > 0
                ? utils_1.Money.round((profitPerPassengerEgp / totalCostPerPassengerEgp) * 100)
                : 0;
            return {
                category,
                flightCostEgp: flightCostAdultEgp,
                accommodationCostSar,
                accommodationCostEgp,
                operationalCostEgp: operationalCostAdultEgp,
                supervisorShareCostEgp: supervisorCostPerPassengerEgp,
                totalCostPerPassengerEgp,
                sellingPriceEgp,
                minimumSellingPriceEgp,
                profitPerPassengerEgp,
                profitMarginPercent,
            };
        };
        const makkah = inp.hotelPerPersonStayCost || inp.makkahHotelPerPersonStaySar || { double: 0, triple: 0, quad: 0 };
        const madinah = inp.hotelPerPersonStayCost ? { single: 0, double: 0, triple: 0, quad: 0 } : (inp.madinahHotelPerPersonStaySar || { double: 0, triple: 0, quad: 0 });
        const singleMakkahSar = makkah.single !== undefined ? makkah.single : utils_1.Money.multiply(makkah.double || 0, 2);
        const singleMadinahSar = madinah.single !== undefined ? madinah.single : utils_1.Money.multiply(madinah.double || 0, 2);
        const singleCat = buildAdultCategory("SINGLE", singleMakkahSar, singleMadinahSar);
        const doubleCat = buildAdultCategory("DOUBLE", makkah.double, madinah.double);
        const tripleCat = buildAdultCategory("TRIPLE", makkah.triple, madinah.triple);
        const quadCat = buildAdultCategory("QUAD", makkah.quad, madinah.quad);
        const childFlightEgp = utils_1.Money.multiply(flightCostAdultEgp, inp.childPolicy?.flightCostMultiplier ?? 0.8);
        const childAccommSar = inp.childPolicy?.includeAccommodation
            ? utils_1.Money.add(makkah.quad, madinah.quad)
            : 0;
        const childAccommEgp = utils_1.Money.convert(childAccommSar, rate);
        const childTotalCostEgp = utils_1.Money.add(childFlightEgp, childAccommEgp, operationalCostAdultEgp, supervisorCostPerPassengerEgp);
        const childSellingEgp = inp.childPolicy?.sellingPriceOverrideEgp !== undefined
            ? utils_1.Money.round(inp.childPolicy.sellingPriceOverrideEgp)
            : utils_1.Money.multiply(childTotalCostEgp, marginFactor);
        const childMinSellingEgp = Math.max(childTotalCostEgp, utils_1.Money.multiply(childSellingEgp, minPriceFactor));
        const childProfitEgp = utils_1.Money.subtract(childSellingEgp, childTotalCostEgp);
        const childCat = {
            category: "CHILD",
            flightCostEgp: childFlightEgp,
            accommodationCostSar: childAccommSar,
            accommodationCostEgp: childAccommEgp,
            operationalCostEgp: operationalCostAdultEgp,
            supervisorShareCostEgp: supervisorCostPerPassengerEgp,
            totalCostPerPassengerEgp: childTotalCostEgp,
            sellingPriceEgp: childSellingEgp,
            minimumSellingPriceEgp: childMinSellingEgp,
            profitPerPassengerEgp: childProfitEgp,
            profitMarginPercent: childTotalCostEgp > 0 ? utils_1.Money.round((childProfitEgp / childTotalCostEgp) * 100) : 0,
        };
        const infantFlightEgp = utils_1.Money.multiply(flightCostAdultEgp, inp.infantPolicy?.flightCostMultiplier ?? 0.2);
        const infantVisaEgp = utils_1.Money.convert(inp.infantPolicy?.visaAndAgentFeeSar ?? 500, rate);
        const infantTotalCostEgp = utils_1.Money.add(infantFlightEgp, infantVisaEgp);
        const infantSellingEgp = inp.infantPolicy?.sellingPriceOverrideEgp !== undefined
            ? utils_1.Money.round(inp.infantPolicy.sellingPriceOverrideEgp)
            : utils_1.Money.multiply(infantTotalCostEgp, marginFactor);
        const infantMinSellingEgp = Math.max(infantTotalCostEgp, utils_1.Money.multiply(infantSellingEgp, minPriceFactor));
        const infantProfitEgp = utils_1.Money.subtract(infantSellingEgp, infantTotalCostEgp);
        const infantCat = {
            category: "INFANT",
            flightCostEgp: infantFlightEgp,
            accommodationCostSar: 0,
            accommodationCostEgp: 0,
            operationalCostEgp: infantVisaEgp,
            supervisorShareCostEgp: 0,
            totalCostPerPassengerEgp: infantTotalCostEgp,
            sellingPriceEgp: infantSellingEgp,
            minimumSellingPriceEgp: infantMinSellingEgp,
            profitPerPassengerEgp: infantProfitEgp,
            profitMarginPercent: infantTotalCostEgp > 0 ? utils_1.Money.round((infantProfitEgp / infantTotalCostEgp) * 100) : 0,
        };
        const totalFlightCostEgp = utils_1.Money.multiply(flightCostAdultEgp, capacity);
        const totalOperationalCostEgp = utils_1.Money.multiply(operationalCostAdultEgp, capacity);
        const estimatedTotalGroupCostEgp = utils_1.Money.multiply(quadCat.totalCostPerPassengerEgp, capacity);
        const estimatedTotalGroupRevenueEgp = utils_1.Money.multiply(quadCat.sellingPriceEgp, capacity);
        const expectedGroupProfitEgp = utils_1.Money.subtract(estimatedTotalGroupRevenueEgp, estimatedTotalGroupCostEgp);
        const expectedGroupProfitMarginPercent = estimatedTotalGroupCostEgp > 0
            ? utils_1.Money.round((expectedGroupProfitEgp / estimatedTotalGroupCostEgp) * 100)
            : 0;
        return {
            exchangeRateSarToEgp: rate,
            totals: {
                totalFlightCostEgp,
                totalOperationalCostEgp,
                totalSupervisorCostEgp,
                supervisorCostPerPassengerEgp,
                estimatedTotalGroupCostEgp,
                estimatedTotalGroupRevenueEgp,
                expectedGroupProfitEgp,
                expectedGroupProfitMarginPercent,
            },
            categories: {
                SINGLE: singleCat,
                DOUBLE: doubleCat,
                TRIPLE: tripleCat,
                QUAD: quadCat,
                CHILD: childCat,
                INFANT: infantCat,
            },
        };
    }
    async createPricingVersion(payload, req) {
        const code = payload.code.toUpperCase().trim();
        const exists = await module_1.PricingVersionModel.findOne({ code });
        if (exists) {
            throw new exception_1.ConflictException(`Pricing version ${code} already exists`);
        }
        const calculated = this.calculateScenario({
            exchangeRateSarToEgp: payload.exchangeRateSarToEgp,
            groupCapacity: payload.groupCapacity,
            inputs: payload.inputs,
        });
        const latestForTrip = payload.tripId
            ? await module_1.PricingVersionModel.findOne({ tripId: payload.tripId }).sort({ versionNumber: -1 })
            : null;
        const version = await module_1.PricingVersionModel.create({
            code,
            name: payload.name,
            tripId: payload.tripId || null,
            versionNumber: latestForTrip ? latestForTrip.versionNumber + 1 : 1,
            exchangeRateSarToEgp: calculated.exchangeRateSarToEgp,
            groupCapacity: payload.groupCapacity,
            inputs: payload.inputs,
            totals: calculated.totals,
            categories: calculated.categories,
            status: "DRAFT",
            createdBy: req.user?._id,
        });
        await service_1.auditService.record({
            req,
            action: "PRICING_VERSION_CREATED",
            module: "pricing",
            entityType: "PricingVersion",
            entityId: version._id.toString(),
            newValues: version.toObject(),
        });
        return version;
    }
    async approvePricingVersion(id, req) {
        return await (0, utils_1.withTransaction)(async (session) => {
            const version = await module_1.PricingVersionModel.findById(id, null, session ? { session } : undefined);
            if (!version)
                throw new exception_1.NotFoundException("Pricing version not found");
            if (version.tripId) {
                await module_1.PricingVersionModel.updateMany({ tripId: version.tripId, status: "APPROVED", _id: { $ne: version._id } }, { $set: { status: "SUPERSEDED" } }, session ? { session } : undefined);
                await module_1.TripModel.updateOne({ _id: version.tripId }, { $set: { approvedPricingVersionId: version._id } }, session ? { session } : undefined);
            }
            version.status = "APPROVED";
            version.approvedBy = req.user?._id;
            version.approvedAt = new Date();
            await version.save(session ? { session } : undefined);
            await service_1.auditService.record({
                req,
                action: "PRICING_VERSION_APPROVED",
                module: "pricing",
                entityType: "PricingVersion",
                entityId: version._id.toString(),
                newValues: version.toObject(),
                session,
            });
            return version;
        });
    }
}
exports.PricingService = PricingService;
exports.pricingService = new PricingService();
