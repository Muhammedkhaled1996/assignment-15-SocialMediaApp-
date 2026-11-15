import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { pricingScenarioValidator } from "../pricing.validation";

export type PricingScenarioDto = z.infer<ReturnType<typeof pricingScenarioValidator>["shape"]["body"]>;
export type PricingValidationLanguage = LanguageEnum;
