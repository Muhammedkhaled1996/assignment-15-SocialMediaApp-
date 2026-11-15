import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createContractValidator, createPartnerValidator } from "../wholesale.validation";

export type CreateWholesalePartnerDto = z.infer<ReturnType<typeof createPartnerValidator>["shape"]["body"]>;
export type CreateWholesaleContractDto = z.infer<ReturnType<typeof createContractValidator>["shape"]["body"]>;
export type WholesaleValidationLanguage = LanguageEnum;
