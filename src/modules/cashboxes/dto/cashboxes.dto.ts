import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createCashboxValidator } from "../cashboxes.validation";

export type CreateCashboxDto = z.infer<ReturnType<typeof createCashboxValidator>["shape"]["body"]>;
export type CashboxValidationLanguage = LanguageEnum;
