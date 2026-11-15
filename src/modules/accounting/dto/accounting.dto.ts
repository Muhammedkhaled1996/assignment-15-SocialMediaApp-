import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { journalEntriesQueryValidator } from "../accounting.validation";

export type JournalEntriesQueryDto = z.infer<ReturnType<typeof journalEntriesQueryValidator>["shape"]["query"]>;
export type AccountingValidationLanguage = LanguageEnum;
