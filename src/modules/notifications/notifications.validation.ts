import { z } from "zod";
import { LanguageEnum } from "../../common/enum";

export const notificationQueryValidator = (_lang: LanguageEnum) =>
  z.object({
    query: z.object({
      unreadOnly: z.string().optional(),
      limit: z.string().optional(),
    }),
  });
