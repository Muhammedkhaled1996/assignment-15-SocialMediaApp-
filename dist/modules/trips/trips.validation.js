"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGroupValidator = exports.createTripValidator = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const createTripValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().optional(),
        nameAr: zod_1.z.string().min(2),
        nameEn: zod_1.z.string().min(2),
        tripCategory: zod_1.z.enum(["DOMESTIC", "RELIGIOUS", "OUTBOUND"]).default("RELIGIOUS"),
        transportType: zod_1.z.enum(["FLIGHT", "BUS", "CRUISE", "TRAIN", "NONE"]).default("FLIGHT"),
        season: zod_1.z.string().min(2),
        destination: zod_1.z.string().default("MAKKAH_MADINAH"),
        coverImage: zod_1.z.string().optional(),
        galleryImages: zod_1.z.array(zod_1.z.string()).default([]),
        itinerary: zod_1.z
            .array(zod_1.z.object({
            dayNumber: zod_1.z.number().int().min(1),
            titleAr: zod_1.z.string().min(2),
            titleEn: zod_1.z.string().optional(),
            descriptionAr: zod_1.z.string().min(2),
            descriptionEn: zod_1.z.string().optional(),
            meals: zod_1.z.array(zod_1.z.string()).default([]),
            activities: zod_1.z.array(zod_1.z.string()).default([]),
        }))
            .default([]),
        departureDate: zod_1.z.string(),
        returnDate: zod_1.z.string(),
        flightAllocations: zod_1.z
            .array(zod_1.z.object({
            flightLotId: utils_1.generalValidationFields.id(lang),
            allocatedSeats: zod_1.z.number().int().min(1),
        }))
            .default([]),
        hotelAllocations: zod_1.z
            .array(zod_1.z.object({
            hotelContractId: utils_1.generalValidationFields.id(lang),
            city: zod_1.z.string().min(2),
            singleRooms: zod_1.z.number().int().min(0).default(0),
            doubleRooms: zod_1.z.number().int().min(0).default(0),
            tripleRooms: zod_1.z.number().int().min(0).default(0),
            quadRooms: zod_1.z.number().int().min(0).default(0),
        }))
            .default([]),
        capacity: zod_1.z.number().int().min(1),
        approvedPricingVersionId: utils_1.generalValidationFields.id(lang).nullable().optional(),
        quotaMode: zod_1.z.enum(["SHARED_QUOTA", "ALLOCATED_QUOTA"]).default("SHARED_QUOTA"),
        includedServices: zod_1.z.array(zod_1.z.string()).default([]),
        requiredDocuments: zod_1.z.array(zod_1.z.string()).default([]),
        status: zod_1.z
            .enum(["DRAFT", "PUBLISHED", "OPEN_FOR_BOOKING", "CLOSED", "DEPARTED", "COMPLETED", "CANCELLED"])
            .default("OPEN_FOR_BOOKING"),
        notes: zod_1.z.string().optional(),
    }),
});
exports.createTripValidator = createTripValidator;
const createGroupValidator = (lang) => zod_1.z.object({
    body: zod_1.z.object({
        code: zod_1.z.string().min(2),
        nameAr: zod_1.z.string().min(2),
        nameEn: zod_1.z.string().min(2),
        tripId: utils_1.generalValidationFields.id(lang),
        supervisorName: zod_1.z.string().optional(),
        supervisorPhone: zod_1.z.string().optional(),
        capacity: zod_1.z.number().int().min(1),
    }),
});
exports.createGroupValidator = createGroupValidator;
