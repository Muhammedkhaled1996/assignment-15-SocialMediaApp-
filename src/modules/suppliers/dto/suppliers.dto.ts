import { z } from "zod";
import { createSupplierValidator, recordLedgerAdjustmentValidator } from "../suppliers.validation";

export type CreateSupplierDto = z.infer<ReturnType<typeof createSupplierValidator>>;
export type RecordLedgerAdjustmentDto = z.infer<ReturnType<typeof recordLedgerAdjustmentValidator>>;
