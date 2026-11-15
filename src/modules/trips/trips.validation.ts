import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createTripValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().optional(),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      tripCategory: z.enum(["DOMESTIC", "RELIGIOUS", "OUTBOUND"]).default("RELIGIOUS"),
      transportType: z.enum(["FLIGHT", "BUS", "CRUISE", "TRAIN", "NONE"]).default("FLIGHT"),
      season: z.string().min(2),
      destination: z.string().default("MAKKAH_MADINAH"),
      coverImage: z.string().optional(),
      galleryImages: z.array(z.string()).default([]),
      itinerary: z
        .array(
          z.object({
            dayNumber: z.number().int().min(1),
            titleAr: z.string().min(2),
            titleEn: z.string().optional(),
            descriptionAr: z.string().min(2),
            descriptionEn: z.string().optional(),
            meals: z.array(z.string()).default([]),
            activities: z.array(z.string()).default([]),
          }),
        )
        .default([]),
      departureDate: z.string(),
      returnDate: z.string(),
      flightAllocations: z
        .array(
          z.object({
            flightLotId: generalValidationFields.id(lang),
            allocatedSeats: z.number().int().min(1),
          }),
        )
        .default([]),
      hotelAllocations: z
        .array(
          z.object({
            hotelContractId: generalValidationFields.id(lang),
            city: z.string().min(2),
            singleRooms: z.number().int().min(0).default(0),
            doubleRooms: z.number().int().min(0).default(0),
            tripleRooms: z.number().int().min(0).default(0),
            quadRooms: z.number().int().min(0).default(0),
          }),
        )
        .default([]),
      capacity: z.number().int().min(1),
      approvedPricingVersionId: generalValidationFields.id(lang).nullable().optional(),
      quotaMode: z.enum(["SHARED_QUOTA", "ALLOCATED_QUOTA"]).default("SHARED_QUOTA"),
      includedServices: z.array(z.string()).default([]),
      requiredDocuments: z.array(z.string()).default([]),
      status: z
        .enum(["DRAFT", "PUBLISHED", "OPEN_FOR_BOOKING", "CLOSED", "DEPARTED", "COMPLETED", "CANCELLED"])
        .default("OPEN_FOR_BOOKING"),
      notes: z.string().optional(),
    }),
  });

export const createGroupValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      code: z.string().min(2),
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      tripId: generalValidationFields.id(lang),
      supervisorName: z.string().optional(),
      supervisorPhone: z.string().optional(),
      capacity: z.number().int().min(1),
    }),
  });
