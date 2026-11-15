import { z } from "zod";
import { LanguageEnum } from "../../common/enum";
import { generalValidationFields } from "../../common/utils";

export const tripDocumentParamValidator = (lang: LanguageEnum) =>
  z.object({
    params: z.object({ tripId: generalValidationFields.id(lang) }),
  });

export const receiptDocumentParamValidator = (lang: LanguageEnum) =>
  z.object({
    params: z.object({ receiptId: generalValidationFields.id(lang) }),
  });
