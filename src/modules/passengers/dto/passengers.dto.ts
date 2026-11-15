import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createPassengerValidator } from "../passengers.validation";

export type CreatePassengerDto = z.infer<ReturnType<typeof createPassengerValidator>["shape"]["body"]>;
export type PassengerValidationLanguage = LanguageEnum;
