import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createReceiptValidator } from "../receipts.validation";

export type CreateReceiptDto = z.infer<ReturnType<typeof createReceiptValidator>["shape"]["body"]>;
export type ReceiptValidationLanguage = LanguageEnum;
