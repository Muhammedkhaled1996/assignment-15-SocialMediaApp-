import { z } from "zod";
import { changePassword, login, logoutSchema } from "../authentication.validation";

export type LoginDto = z.infer<ReturnType<typeof login>>;
export type ChangePasswordDto = z.infer<ReturnType<typeof changePassword>>;
export type LogoutDto = z.infer<ReturnType<typeof logoutSchema>>;
