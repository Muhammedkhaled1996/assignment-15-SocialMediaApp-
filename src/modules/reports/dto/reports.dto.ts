import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { tripProfitabilityQueryValidator } from "../reports.validation";

export type TripProfitabilityQueryDto = z.infer<ReturnType<typeof tripProfitabilityQueryValidator>["shape"]["query"]>;
export type ReportValidationLanguage = LanguageEnum;
