import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { receiptDocumentParamValidator, tripDocumentParamValidator } from "../documents.validation";

export type TripDocumentParamDto = z.infer<ReturnType<typeof tripDocumentParamValidator>["shape"]["params"]>;
export type ReceiptDocumentParamDto = z.infer<ReturnType<typeof receiptDocumentParamValidator>["shape"]["params"]>;
export type DocumentValidationLanguage = LanguageEnum;
