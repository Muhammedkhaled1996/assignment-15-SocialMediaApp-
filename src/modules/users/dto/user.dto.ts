import { z } from "zod";
import {
  adminResetPassword,
  changeUserRole,
  createStaffUser,
  updateProfile,
  updateUser,
} from "../user.validation";

export type CreateStaffUserDto = z.infer<ReturnType<typeof createStaffUser>>;
export type UpdateUserDto = z.infer<ReturnType<typeof updateUser>>;
export type UpdateProfileDto = z.infer<ReturnType<typeof updateProfile>>;
export type ChangeUserRoleDto = z.infer<ReturnType<typeof changeUserRole>>;
export type AdminResetPasswordDto = z.infer<ReturnType<typeof adminResetPassword>>;
