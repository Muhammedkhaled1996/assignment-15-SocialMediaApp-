import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const createHotelValidator = (_lang: LanguageEnum) =>
  z.object({
    body: z.object({
      nameAr: z.string().min(2),
      nameEn: z.string().min(2),
      city: z.string().min(2),
      country: z.string().min(2).optional(),
      stars: z.number().int().min(1).max(7).default(4),
      distanceToHaramMeters: z.number().min(0).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
    }),
  });

export const createHotelContractValidator = (lang: LanguageEnum) =>
  z.object({
    body: z.object({
      contractNumber: z.string().optional(),
      hotelId: generalValidationFields.id(lang),
      supplierId: generalValidationFields.id(lang),
      city: z.string().min(2).optional(),
      checkIn: z.string(),
      checkOut: z.string(),
      nights: z.number().int().min(1).optional(),
      roomCapacities: z.object({
        singleRooms: z.number().int().min(0).default(0),
        doubleRooms: z.number().int().min(0).default(0),
        tripleRooms: z.number().int().min(0).default(0),
        quadRooms: z.number().int().min(0).default(0),
      }),
      pricingMode: z.enum(["FLAT_RATE", "TIERED_RATE"]),
      currency: z.enum(["SAR", "EGP", "USD", "EUR"]).default("SAR"),
      rates: z.object({
        flatRoomRatePerNight: z.number().min(0).optional(),
        singleRoomRatePerNight: z.number().min(0).optional(),
        doubleRoomRatePerNight: z.number().min(0).optional(),
        tripleRoomRatePerNight: z.number().min(0).optional(),
        quadRoomRatePerNight: z.number().min(0).optional(),
      }),
      exchangeRateToEgp: z.number().positive().default(1),
      paymentTerms: z.string().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    }),
  });
