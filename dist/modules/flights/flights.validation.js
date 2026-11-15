"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFlightValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createFlightValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        contractReference: zod_1.z.string().optional(),
        airline: zod_1.z.string().min(2),
        airlineCode: zod_1.z.string().optional(),
        flightNumberOutbound: zod_1.z.string().optional(),
        flightNumberReturn: zod_1.z.string().optional(),
        supplierId: utils_1.generalValidationFields.id(lang),
        brokerId: utils_1.generalValidationFields.id(lang).nullable().optional(),
        purchaseSource: zod_1.z.enum(["DIRECT", "BROKER"]).default("DIRECT"),
        flightRoute: zod_1.z.string().min(3),
        departureAirport: zod_1.z.string().min(3),
        arrivalAirport: zod_1.z.string().min(3),
        returnDepartureAirport: zod_1.z.string().optional(),
        returnArrivalAirport: zod_1.z.string().optional(),
        departureDate: zod_1.z.string(),
        returnDate: zod_1.z.string(),
        seatQuantity: zod_1.z.number().int().min(1),
        unitCost: zod_1.z.number().min(0),
        currency: zod_1.z.enum(["EGP", "SAR", "USD"]).default("EGP"),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
        paymentTerms: zod_1.z.string().optional(),
        paymentSchedule: zod_1.z
            .array(zod_1.z.object({
            dueDate: zod_1.z.string(),
            amount: zod_1.z.number().min(0),
            description: zod_1.z.string().optional(),
        }))
            .optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createFlightValidator = createFlightValidator;
