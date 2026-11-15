import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createBookingValidator } from "../bookings.validation";

export type CreateBookingDto = z.infer<ReturnType<typeof createBookingValidator>["shape"]["body"]>;
export type BookingValidationLanguage = LanguageEnum;
