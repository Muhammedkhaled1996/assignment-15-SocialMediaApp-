"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHotelContractValidator = exports.createHotelValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createHotelValidator = (_lang) => zod_1.z.object({
    body: zod_1.z.object({
        nameAr: zod_1.z.string().min(2),
        nameEn: zod_1.z.string().min(2),
        city: zod_1.z.string().min(2),
        country: zod_1.z.string().min(2).optional(),
        stars: zod_1.z.number().int().min(1).max(7).default(4),
        distanceToHaramMeters: zod_1.z.number().min(0).optional(),
        address: zod_1.z.string().optional(),
        phone: zod_1.z.string().optional(),
    }),
});
exports.createHotelValidator = createHotelValidator;
const createHotelContractValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        contractNumber: zod_1.z.string().optional(),
        hotelId: utils_1.generalValidationFields.id(lang),
        supplierId: utils_1.generalValidationFields.id(lang),
        city: zod_1.z.string().min(2).optional(),
        checkIn: zod_1.z.string(),
        checkOut: zod_1.z.string(),
        nights: zod_1.z.number().int().min(1).optional(),
        roomCapacities: zod_1.z.object({
            singleRooms: zod_1.z.number().int().min(0).default(0),
            doubleRooms: zod_1.z.number().int().min(0).default(0),
            tripleRooms: zod_1.z.number().int().min(0).default(0),
            quadRooms: zod_1.z.number().int().min(0).default(0),
        }),
        pricingMode: zod_1.z.enum(["FLAT_RATE", "TIERED_RATE"]),
        currency: zod_1.z.enum(["SAR", "EGP", "USD", "EUR"]).default("SAR"),
        rates: zod_1.z.object({
            flatRoomRatePerNight: zod_1.z.number().min(0).optional(),
            singleRoomRatePerNight: zod_1.z.number().min(0).optional(),
            doubleRoomRatePerNight: zod_1.z.number().min(0).optional(),
            tripleRoomRatePerNight: zod_1.z.number().min(0).optional(),
            quadRoomRatePerNight: zod_1.z.number().min(0).optional(),
        }),
        exchangeRateToEgp: zod_1.z.number().positive().default(1),
        paymentTerms: zod_1.z.string().optional(),
        dueDate: zod_1.z.string().optional(),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createHotelContractValidator = createHotelContractValidator;
