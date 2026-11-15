import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const pricingScenarioValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().min(2).optional(),
      name: z.string().min(2).optional(),
      tripId: generalValidationFields.id(lang).nullable().optional(),
      exchangeRateSarToEgp: z.number().positive().default(1),
      groupCapacity: z.number().int().min(1),
      inputs: z.object({
        flightCostPerSeatEgp: z.number().min(0).default(0),
        hotelPerPersonStayCost: z
          .object({
            single: z.number().min(0).optional(),
            double: z.number().min(0),
            triple: z.number().min(0),
            quad: z.number().min(0),
          })
          .optional(),
        makkahHotelPerPersonStaySar: z
          .object({
            single: z.number().min(0).optional(),
            double: z.number().min(0),
            triple: z.number().min(0),
            quad: z.number().min(0),
          })
          .default({ double: 0, triple: 0, quad: 0 }),
        madinahHotelPerPersonStaySar: z
          .object({
            single: z.number().min(0).optional(),
            double: z.number().min(0),
            triple: z.number().min(0),
            quad: z.number().min(0),
          })
          .default({ double: 0, triple: 0, quad: 0 }),
        saudiAgentFeeSar: z.number().min(0).default(0),
        transportCostSar: z.number().min(0).default(0),
        barcodeFeeEgp: z.number().min(0).default(0),
        giftsCostEgp: z.number().min(0).default(0),
        otherOperationalCostEgp: z.number().min(0).default(0),
        supervisorFlightTicketEgp: z.number().min(0).default(0),
        supervisorAccommodationSar: z.number().min(0).default(0),
        supervisorGratuitiesEgp: z.number().min(0).default(0),
        targetProfitMarginPercent: z.number().min(0).default(15),
        maxDiscountPercentAllowed: z.number().min(0).max(100).default(5),
        childPolicy: z
          .object({
            flightCostMultiplier: z.number().min(0).default(0.8),
            includeAccommodation: z.boolean().default(false),
            sellingPriceOverrideEgp: z.number().min(0).optional(),
          })
          .default({ flightCostMultiplier: 0.8, includeAccommodation: false }),
        infantPolicy: z
          .object({
            flightCostMultiplier: z.number().min(0).default(0.2),
            visaAndAgentFeeSar: z.number().min(0).default(500),
            sellingPriceOverrideEgp: z.number().min(0).optional(),
          })
          .default({ flightCostMultiplier: 0.2, visaAndAgentFeeSar: 500 }),
      }),
    }),
  });
