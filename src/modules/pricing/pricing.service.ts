import { Request } from "express";
import {
  ICategoryPricingBreakdown,
  IPricingVersion,
  PassengerCategory,
  PricingVersionModel,
  TripModel,
} from "../../DB/module";
import { DatabaseRepository } from "../../common/repository/base.repository";
import { BadRequestException, ConflictException, NotFoundException } from "../../common/exception";
import { auditService } from "../../common/service";
import { Money, withTransaction } from "../../common/utils";

export class PricingVersionRepository extends DatabaseRepository<any> {
  constructor() {
    super(PricingVersionModel);
  }
}

export class PricingService {
  /**
   * Deterministic Dynamic Cost & Pricing Engine for Umrah Operations.
   */
  calculateScenario(params: {
    exchangeRateSarToEgp: number;
    groupCapacity: number;
    inputs: IPricingVersion["inputs"];
  }): {
    exchangeRateSarToEgp: number;
    totals: IPricingVersion["totals"];
    categories: Record<PassengerCategory, ICategoryPricingBreakdown>;
  } {
    const rate = Money.roundRate(params.exchangeRateSarToEgp);
    const capacity = Math.floor(params.groupCapacity);
    if (rate <= 0) throw new BadRequestException("Exchange rate SAR/EGP must be positive");
    if (capacity < 1) throw new BadRequestException("Group capacity must be at least 1");

    const inp = params.inputs;
    const flightCostAdultEgp = Money.round(inp.flightCostPerSeatEgp);

    const supervisorAccommEgp = Money.convert(inp.supervisorAccommodationSar || 0, rate);
    const totalSupervisorCostEgp = Money.add(
      inp.supervisorFlightTicketEgp || 0,
      supervisorAccommEgp,
      inp.supervisorGratuitiesEgp || 0,
    );
    const supervisorCostPerPassengerEgp = Money.divide(totalSupervisorCostEgp, capacity);

    const saudiAndTransportSar = Money.add(inp.saudiAgentFeeSar || 0, inp.transportCostSar || 0);
    const saudiAndTransportEgp = Money.convert(saudiAndTransportSar, rate);
    const operationalCostAdultEgp = Money.add(
      saudiAndTransportEgp,
      inp.barcodeFeeEgp || 0,
      inp.giftsCostEgp || 0,
      inp.otherOperationalCostEgp || 0,
    );

    const marginFactor = 1 + (inp.targetProfitMarginPercent || 0) / 100;
    const minPriceFactor = 1 - (inp.maxDiscountPercentAllowed || 0) / 100;

    const buildAdultCategory = (
      category: "SINGLE" | "DOUBLE" | "TRIPLE" | "QUAD",
      makkahSar: number,
      madinahSar: number,
    ): ICategoryPricingBreakdown => {
      const accommodationCostSar = Money.add(makkahSar, madinahSar);
      const accommodationCostEgp = Money.convert(accommodationCostSar, rate);
      const totalCostPerPassengerEgp = Money.add(
        flightCostAdultEgp,
        accommodationCostEgp,
        operationalCostAdultEgp,
        supervisorCostPerPassengerEgp,
      );
      const sellingPriceEgp = Money.multiply(totalCostPerPassengerEgp, marginFactor);
      const minimumSellingPriceEgp = Math.max(
        totalCostPerPassengerEgp,
        Money.multiply(sellingPriceEgp, minPriceFactor),
      );
      const profitPerPassengerEgp = Money.subtract(sellingPriceEgp, totalCostPerPassengerEgp);
      const profitMarginPercent =
        totalCostPerPassengerEgp > 0
          ? Money.round((profitPerPassengerEgp / totalCostPerPassengerEgp) * 100)
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

    const makkah = (inp as any).hotelPerPersonStayCost || inp.makkahHotelPerPersonStaySar || { double: 0, triple: 0, quad: 0 };
    const madinah = (inp as any).hotelPerPersonStayCost ? { single: 0, double: 0, triple: 0, quad: 0 } : (inp.madinahHotelPerPersonStaySar || { double: 0, triple: 0, quad: 0 });

    const singleMakkahSar = makkah.single !== undefined ? makkah.single : Money.multiply(makkah.double || 0, 2);
    const singleMadinahSar = madinah.single !== undefined ? madinah.single : Money.multiply(madinah.double || 0, 2);

    const singleCat = buildAdultCategory("SINGLE", singleMakkahSar, singleMadinahSar);
    const doubleCat = buildAdultCategory(
      "DOUBLE",
      makkah.double,
      madinah.double,
    );
    const tripleCat = buildAdultCategory(
      "TRIPLE",
      makkah.triple,
      madinah.triple,
    );
    const quadCat = buildAdultCategory(
      "QUAD",
      makkah.quad,
      madinah.quad,
    );

    const childFlightEgp = Money.multiply(flightCostAdultEgp, inp.childPolicy?.flightCostMultiplier ?? 0.8);
    const childAccommSar = inp.childPolicy?.includeAccommodation
      ? Money.add(makkah.quad, madinah.quad)
      : 0;
    const childAccommEgp = Money.convert(childAccommSar, rate);
    const childTotalCostEgp = Money.add(
      childFlightEgp,
      childAccommEgp,
      operationalCostAdultEgp,
      supervisorCostPerPassengerEgp,
    );
    const childSellingEgp =
      inp.childPolicy?.sellingPriceOverrideEgp !== undefined
        ? Money.round(inp.childPolicy.sellingPriceOverrideEgp)
        : Money.multiply(childTotalCostEgp, marginFactor);
    const childMinSellingEgp = Math.max(childTotalCostEgp, Money.multiply(childSellingEgp, minPriceFactor));
    const childProfitEgp = Money.subtract(childSellingEgp, childTotalCostEgp);

    const childCat: ICategoryPricingBreakdown = {
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
      profitMarginPercent: childTotalCostEgp > 0 ? Money.round((childProfitEgp / childTotalCostEgp) * 100) : 0,
    };

    const infantFlightEgp = Money.multiply(flightCostAdultEgp, inp.infantPolicy?.flightCostMultiplier ?? 0.2);
    const infantVisaEgp = Money.convert(inp.infantPolicy?.visaAndAgentFeeSar ?? 500, rate);
    const infantTotalCostEgp = Money.add(infantFlightEgp, infantVisaEgp);
    const infantSellingEgp =
      inp.infantPolicy?.sellingPriceOverrideEgp !== undefined
        ? Money.round(inp.infantPolicy.sellingPriceOverrideEgp)
        : Money.multiply(infantTotalCostEgp, marginFactor);
    const infantMinSellingEgp = Math.max(infantTotalCostEgp, Money.multiply(infantSellingEgp, minPriceFactor));
    const infantProfitEgp = Money.subtract(infantSellingEgp, infantTotalCostEgp);

    const infantCat: ICategoryPricingBreakdown = {
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
      profitMarginPercent: infantTotalCostEgp > 0 ? Money.round((infantProfitEgp / infantTotalCostEgp) * 100) : 0,
    };

    const totalFlightCostEgp = Money.multiply(flightCostAdultEgp, capacity);
    const totalOperationalCostEgp = Money.multiply(operationalCostAdultEgp, capacity);
    const estimatedTotalGroupCostEgp = Money.multiply(quadCat.totalCostPerPassengerEgp, capacity);
    const estimatedTotalGroupRevenueEgp = Money.multiply(quadCat.sellingPriceEgp, capacity);
    const expectedGroupProfitEgp = Money.subtract(estimatedTotalGroupRevenueEgp, estimatedTotalGroupCostEgp);
    const expectedGroupProfitMarginPercent =
      estimatedTotalGroupCostEgp > 0
        ? Money.round((expectedGroupProfitEgp / estimatedTotalGroupCostEgp) * 100)
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

  async createPricingVersion(payload: any, req: Request) {
    const code = payload.code.toUpperCase().trim();
    const exists = await PricingVersionModel.findOne({ code });
    if (exists) {
      throw new ConflictException(`Pricing version ${code} already exists`);
    }

    const calculated = this.calculateScenario({
      exchangeRateSarToEgp: payload.exchangeRateSarToEgp,
      groupCapacity: payload.groupCapacity,
      inputs: payload.inputs,
    });

    const latestForTrip = payload.tripId
      ? await PricingVersionModel.findOne({ tripId: payload.tripId }).sort({ versionNumber: -1 })
      : null;

    const version = await PricingVersionModel.create({
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

    await auditService.record({
      req,
      action: "PRICING_VERSION_CREATED",
      module: "pricing",
      entityType: "PricingVersion",
      entityId: version._id.toString(),
      newValues: version.toObject(),
    });

    return version;
  }

  async approvePricingVersion(id: string, req: Request) {
    return await withTransaction(async (session) => {
      const version = await PricingVersionModel.findById(id, null, session ? { session } : undefined);
      if (!version) throw new NotFoundException("Pricing version not found");

      if (version.tripId) {
        await PricingVersionModel.updateMany(
          { tripId: version.tripId, status: "APPROVED", _id: { $ne: version._id } },
          { $set: { status: "SUPERSEDED" } },
          session ? { session } : undefined,
        );
        await TripModel.updateOne(
          { _id: version.tripId },
          { $set: { approvedPricingVersionId: version._id } },
          session ? { session } : undefined,
        );
      }

      version.status = "APPROVED";
      version.approvedBy = req.user?._id;
      version.approvedAt = new Date();
      await version.save(session ? { session } : undefined);

      await auditService.record({
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

export const pricingService = new PricingService();
