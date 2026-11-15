import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createFlightValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      contractReference: z.string().optional(),
      airline: z.string().min(2),
      airlineCode: z.string().optional(),
      flightNumberOutbound: z.string().optional(),
      flightNumberReturn: z.string().optional(),
      supplierId: generalValidationFields.id(lang),
      brokerId: generalValidationFields.id(lang).nullable().optional(),
      purchaseSource: z.enum(["DIRECT", "BROKER"]).default("DIRECT"),
      flightRoute: z.string().min(3),
      departureAirport: z.string().min(3),
      arrivalAirport: z.string().min(3),
      returnDepartureAirport: z.string().optional(),
      returnArrivalAirport: z.string().optional(),
      departureDate: z.string(),
      returnDate: z.string(),
      seatQuantity: z.number().int().min(1),
      unitCost: z.number().min(0),
      currency: z.enum(["EGP", "SAR", "USD"]).default("EGP"),
      exchangeRateToEgp: z.number().positive().default(1),
      paymentTerms: z.string().optional(),
      paymentSchedule: z
        .array(
          z.object({
            dueDate: z.string(),
            amount: z.number().min(0),
            description: z.string().optional(),
          }),
        )
        .optional(),
      notes: z.string().optional(),
    }),
  });
