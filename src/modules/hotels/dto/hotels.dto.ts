import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createHotelContractValidator, createHotelValidator } from "../hotels.validation";

export type CreateHotelDto = z.infer<ReturnType<typeof createHotelValidator>["shape"]["body"]>;
export type CreateHotelContractDto = z.infer<ReturnType<typeof createHotelContractValidator>["shape"]["body"]>;
export type HotelValidationLanguage = LanguageEnum;
