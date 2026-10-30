import { z } from "zod";
import { confirmEmail, login, resendOtp, resetPassword, signup } from "../authentication.validation";

export type SignupDto = z.infer<ReturnType<typeof signup>>;
export type LoginDto = z.infer<ReturnType<typeof login>>;
export type ConfirmEmailDto = z.infer<ReturnType<typeof confirmEmail>>;
export type ResendOTPDto = z.infer<ReturnType<typeof resendOtp>>;
export type resetPasswordDto = z.infer<ReturnType<typeof resetPassword>>;
