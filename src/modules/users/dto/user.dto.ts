import { z } from "zod";
import { update } from "../user.validation";

export type updateDto = z.infer<ReturnType<typeof update>>;
