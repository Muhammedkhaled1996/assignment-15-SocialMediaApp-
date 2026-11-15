import { z } from "zod";
import { LanguageEnum } from "../../common/enum";

export const upsertSettingValidator = (_lang: LanguageEnum) =>
  z.object({
    params: z.object({ key: z.string().min(1) }),
    body: z.object({
      value: z.any(),
      category: z.string().optional(),
      description: z.string().optional(),
    }),
  });
