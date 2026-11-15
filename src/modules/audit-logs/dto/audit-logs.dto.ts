import { z } from "zod";
import { listAuditLogsValidator } from "../audit-logs.validation";

export type ListAuditLogsDto = z.infer<ReturnType<typeof listAuditLogsValidator>>;
