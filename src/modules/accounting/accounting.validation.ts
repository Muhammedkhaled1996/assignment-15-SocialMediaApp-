import { z } from "zod";
import { LanguageEnum } from "../../common/enum";

export const journalEntriesQueryValidator = (_lang: LanguageEnum) =>
  z.object({
    query: z.object({
      sourceModule: z.string().optional(),
      branchId: z.string().optional(),
      tripId: z.string().optional(),
      status: z.enum(["POSTED", "REVERSED"]).optional(),
      limit: z.string().optional(),
    }),
  });
