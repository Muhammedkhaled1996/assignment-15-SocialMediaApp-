import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createGroupValidator, createTripValidator } from "../trips.validation";

export type CreateTripDto = z.infer<ReturnType<typeof createTripValidator>["shape"]["body"]>;
export type CreateGroupDto = z.infer<ReturnType<typeof createGroupValidator>["shape"]["body"]>;
export type TripValidationLanguage = LanguageEnum;
