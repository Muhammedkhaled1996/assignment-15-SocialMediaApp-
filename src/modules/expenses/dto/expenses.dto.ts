import { z } from "zod";
import { LanguageEnum } from "../../../common/enum";
import { createExpenseValidator } from "../expenses.validation";

export type CreateExpenseDto = z.infer<ReturnType<typeof createExpenseValidator>["shape"]["body"]>;
export type ExpenseValidationLanguage = LanguageEnum;
