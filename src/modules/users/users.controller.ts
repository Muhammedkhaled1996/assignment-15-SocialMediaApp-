import { Router } from "express";
import type { Request } from "express";
import { authentication, authorizeRoles } from "../../middleware/authentication.middleware.js";
import UserService from "./users.services";
import { responceFormatter } from "../../middleware/responce.middleware.js";
import { IUser } from "../../common/interface/user.interface.js";
import { IResponse } from "../../common/interface/responce.interface.js";
import { IPagination } from "../../common/interface/pagination.interface.js";
import { validation } from "../../middleware/validation.middleware.js";
import * as validator from "./user.validation.js";
import { USER_ROLE_LABELS, UserRole } from "../../common/enum/index.js";

const router = Router({ caseSensitive: true, strict: true });

// Update current authenticated user profile
router.patch(
  "/profile",
  authentication(),
  validation(validator.updateProfile),
  responceFormatter(async (req: Request): Promise<IResponse<IUser>> => {
    const data = await UserService.updateProfile(req.user, req.validate.body);
    return { data };
  }),
);

// List users
router.get(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER),
  responceFormatter(async (req: Request): Promise<IResponse<IPagination<IUser>>> => {
    const data = await UserService.listStaffUsers(req.query as any, req.branchContext);
    return { data };
  }),
);

// Create user
router.post(
  "/",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(validator.createStaffUser),
  responceFormatter(async (req: Request): Promise<IResponse<IUser>> => {
    const data = await UserService.createStaffUser(req.validate.body, req.user, req.branchContext);
    return { status: 201, data };
  }),
);

// Get user by ID
router.get(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.BRANCH_MANAGER),
  validation(validator.userIdParam),
  responceFormatter(async (req: Request): Promise<IResponse<IUser>> => {
    const data = await UserService.getUserById(req.validate.params.id, req.user, req.branchContext);
    return { data };
  }),
);

// Update user details
router.patch(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(validator.updateUser),
  responceFormatter(async (req: Request): Promise<IResponse<IUser>> => {
    const data = await UserService.updateUser(req.validate.params.id, req.validate.body, req.user, req.branchContext);
    return { data };
  }),
);

// Change user numeric role (roleNumber)
router.patch(
  "/:id/role",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(validator.changeUserRole),
  responceFormatter(async (req: Request): Promise<IResponse<IUser>> => {
    const data = await UserService.changeUserRole(
      req.validate.params.id,
      req.validate.body.roleNumber,
      req.user,
      req.validate.body.reason,
    );
    return { data };
  }),
);

// Administrative password reset
router.patch(
  "/:id/reset-password",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(validator.adminResetPassword),
  responceFormatter(async (req: Request): Promise<IResponse<object>> => {
    const data = await UserService.adminResetPassword(
      req.validate.params.id,
      req.validate.body.newPassword,
      req.user,
    );
    return { data };
  }),
);

// Soft-delete / archive user
router.delete(
  "/:id",
  authentication(),
  authorizeRoles(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  validation(validator.userIdParam),
  responceFormatter(async (req: Request): Promise<IResponse<object>> => {
    const data = await UserService.deleteOrDeactivateUser(req.validate.params.id, req.user, req.branchContext);
    return { data };
  }),
);

export default router;
