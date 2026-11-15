import { z } from "zod";
import { createBranchValidator, updateBranchValidator } from "../branches.validation";

export type CreateBranchDto = z.infer<ReturnType<typeof createBranchValidator>>;
export type UpdateBranchDto = z.infer<ReturnType<typeof updateBranchValidator>>;
