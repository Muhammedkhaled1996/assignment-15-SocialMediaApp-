import { z } from "zod";
import { LanguageEnum } from "../../common/enum";

export const tripProfitabilityQueryValidator = (_lang: LanguageEnum) =>
  z.object({
    query: z.object({
      tripId: z.string().optional(),
      season: z.string().optional(),
    }),
  });
