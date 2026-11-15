import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createTransferValidator } from "../transfers.validation";

export type CreateTransferDto = z.infer<ReturnType<typeof createTransferValidator>["shape"]["body"]>;
export type TransferValidationLanguage = LanguageEnum;
