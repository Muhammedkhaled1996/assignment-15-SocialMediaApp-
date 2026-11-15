import { z } from "zod";
import { LanguageEnum } from "../../common/enum";

export const listAuditLogsValidator = (_lang: LanguageEnum) =>
  z.object({
    query: z
      .object({
        branchId: z.string().optional(),
        module: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
        actorId: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
      })
      .optional(),
  });
