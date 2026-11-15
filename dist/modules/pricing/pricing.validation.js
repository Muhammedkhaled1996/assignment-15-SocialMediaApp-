"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pricingScenarioValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const pricingScenarioValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(2).optional(),
        name: zod_1.z.string().min(2).optional(),
        tripId: utils_1.generalValidationFields.id(lang).nullable().optional(),
        exchangeRateSarToEgp: zod_1.z.number().positive().default(1),
        groupCapacity: zod_1.z.number().int().min(1),
        inputs: zod_1.z.object({
            flightCostPerSeatEgp: zod_1.z.number().min(0).default(0),
            hotelPerPersonStayCost: zod_1.z
                .object({
                single: zod_1.z.number().min(0).optional(),
                double: zod_1.z.number().min(0),
                triple: zod_1.z.number().min(0),
                quad: zod_1.z.number().min(0),
            })
                .optional(),
            makkahHotelPerPersonStaySar: zod_1.z
                .object({
                single: zod_1.z.number().min(0).optional(),
                double: zod_1.z.number().min(0),
                triple: zod_1.z.number().min(0),
                quad: zod_1.z.number().min(0),
            })
                .default({ double: 0, triple: 0, quad: 0 }),
            madinahHotelPerPersonStaySar: zod_1.z
                .object({
                single: zod_1.z.number().min(0).optional(),
                double: zod_1.z.number().min(0),
                triple: zod_1.z.number().min(0),
                quad: zod_1.z.number().min(0),
            })
                .default({ double: 0, triple: 0, quad: 0 }),
            saudiAgentFeeSar: zod_1.z.number().min(0).default(0),
            transportCostSar: zod_1.z.number().min(0).default(0),
            barcodeFeeEgp: zod_1.z.number().min(0).default(0),
            giftsCostEgp: zod_1.z.number().min(0).default(0),
            otherOperationalCostEgp: zod_1.z.number().min(0).default(0),
            supervisorFlightTicketEgp: zod_1.z.number().min(0).default(0),
            supervisorAccommodationSar: zod_1.z.number().min(0).default(0),
            supervisorGratuitiesEgp: zod_1.z.number().min(0).default(0),
            targetProfitMarginPercent: zod_1.z.number().min(0).default(15),
            maxDiscountPercentAllowed: zod_1.z.number().min(0).max(100).default(5),
            childPolicy: zod_1.z
                .object({
                flightCostMultiplier: zod_1.z.number().min(0).default(0.8),
                includeAccommodation: zod_1.z.boolean().default(false),
                sellingPriceOverrideEgp: zod_1.z.number().min(0).optional(),
            })
                .default({ flightCostMultiplier: 0.8, includeAccommodation: false }),
            infantPolicy: zod_1.z
                .object({
                flightCostMultiplier: zod_1.z.number().min(0).default(0.2),
                visaAndAgentFeeSar: zod_1.z.number().min(0).default(500),
                sellingPriceOverrideEgp: zod_1.z.number().min(0).optional(),
            })
                .default({ flightCostMultiplier: 0.2, visaAndAgentFeeSar: 500 }),
        }),
    }),
});
exports.pricingScenarioValidator = pricingScenarioValidator;
