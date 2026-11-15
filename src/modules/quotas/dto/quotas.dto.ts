import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { allocateValidator, transferValidator } from "../quotas.validation";

export type AllocateQuotaDto = z.infer<ReturnType<typeof allocateValidator>["shape"]["body"]>;
export type TransferQuotaDto = z.infer<ReturnType<typeof transferValidator>["shape"]["body"]>;
export type QuotaValidationLanguage = LanguageEnum;
