import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { TokenEnum } from "../common/enum/TokenEnum.js";
import { COMPANY_WIDE_ROLES, USER_ROLE_LABELS, UserRole } from "../common/enum/userRole.enum.js";
import type { NextFunction, Request, Response } from "express";
import { ForbiddenException, UnauthorizedException } from "../common/exception/domain.exception.js";
import { tokenSecurityService } from "../common/service/token.service.js";
import { IBranchScopeContext } from "../common/types/express.types.js";
import { IUser } from "../common/interface/user.interface.js";

function extractCookieToken(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [k, ...v] = part.trim().split("=");
    if (k === cookieName) {
      return decodeURIComponent(v.join("="));
    }
  }
  return undefined;
}

/**
 * Resolves branch access scope from the authenticated user's numeric role (`roleNumber`)
 * and assigned branch IDs.
 * - SUPER_ADMIN (1) and ADMIN (2), as well as company-wide HQ roles (ACCOUNTANT, PROCUREMENT, OPERATIONS)
 *   or users with `canAccessAllBranches = true`, have company-wide branch visibility (`isCentralAdmin: true`).
 * - BRANCH_MANAGER (3), SALES (5), and EMPLOYEE (8) are restricted strictly to their assigned branch(es).
 */
export function resolveBranchContext(user: IUser, requestedBranchId?: string): IBranchScopeContext {
  const roleNumber = user.roleNumber || UserRole.EMPLOYEE;
  const isCompanyWideRole =
    COMPANY_WIDE_ROLES.includes(roleNumber) || Boolean(user.canAccessAllBranches);

  const allowedBranchesSet = new Set<string>();
  if (user.branchId) {
    allowedBranchesSet.add(user.branchId.toString());
  }
  if (user.primaryBranchId) {
    allowedBranchesSet.add(user.primaryBranchId.toString());
  }
  if (Array.isArray(user.assignedBranchIds)) {
    for (const b of user.assignedBranchIds) {
      if (b) allowedBranchesSet.add(b.toString());
    }
  }

  const allowedBranchIds = Array.from(allowedBranchesSet);
  let activeBranchId =
    user.branchId?.toString() || user.primaryBranchId?.toString() || allowedBranchIds[0];

  if (requestedBranchId && mongoose.Types.ObjectId.isValid(requestedBranchId)) {
    if (isCompanyWideRole || allowedBranchesSet.has(requestedBranchId)) {
      activeBranchId = requestedBranchId;
    }
  }

  return {
    isCentralAdmin: isCompanyWideRole,
    allowedBranchIds,
    activeBranchId,
    companyId: user.companyId?.toString(),
  };
}

export const bearerAuth = async ({ req, tokenType = TokenEnum.Access }: { req: Request; tokenType?: TokenEnum }) => {
  let authorization = req.headers.authorization;
  if (!authorization && req.headers.cookie) {
    const cookieToken =
      tokenType === TokenEnum.Refresh
        ? extractCookieToken(req.headers.cookie, "refresh_token")
        : extractCookieToken(req.headers.cookie, "access_token");
    if (cookieToken) {
      authorization = `Bearer ${cookieToken}`;
    }
  }
  const { user, payload } = await tokenSecurityService.decodeToken({ authorization, tokenType });
  req.user = user;
  req.payload = payload;

  if (!req.requestId) {
    req.requestId = (req.headers["x-request-id"] as string) || randomUUID();
  }

  const headerBranchId = (req.headers["x-branch-id"] as string) || undefined;
  req.branchContext = resolveBranchContext(user, headerBranchId);
};

export const authentication = (tokenType = TokenEnum.Access) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    await bearerAuth({ req, tokenType });
    next();
  };
};

export const authenticate = authentication();

/**
 * Centralized numeric-role authorization middleware.
 * Reads the authenticated user's `roleNumber` from the verified server-side database user (`req.user`).
 * Never trusts role numbers sent by the client in headers, query, or body.
 */
export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  const allowedSet = new Set<UserRole>(allowedRoles);
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new UnauthorizedException("Authentication required");
    }
    if (req.user.isActive === false || (req.user.accountStatus && req.user.accountStatus !== "ACTIVE")) {
      throw new ForbiddenException("Account is deactivated");
    }
    const userRole = req.user.roleNumber as UserRole;
    if (!userRole || !allowedSet.has(userRole)) {
      const allowedNames = allowedRoles.map((r) => `${USER_ROLE_LABELS[r]}(${r})`).join(", ");
      throw new ForbiddenException(`Access denied. Required role: [${allowedNames}]`);
    }
    next();
  };
};

/**
 * Enforces server-side branch isolation.
 * - Never trusts unverified client branchId if the user is not authorized for that branch.
 * - Provides helper methods to scope MongoDB queries and validate target branchIds.
 */
export function resolveScopedBranchFilter(
  branchContext: IBranchScopeContext | undefined,
  requestedBranchId?: string | mongoose.Types.ObjectId,
  fieldName: string = "branchId",
): Record<string, any> {
  if (!branchContext) {
    throw new ForbiddenException("Branch context is not initialized");
  }

  const reqBranchStr = requestedBranchId ? requestedBranchId.toString() : undefined;

  if (branchContext.isCentralAdmin) {
    if (reqBranchStr && mongoose.Types.ObjectId.isValid(reqBranchStr)) {
      return { [fieldName]: new mongoose.Types.ObjectId(reqBranchStr) };
    }
    return {};
  }

  if (branchContext.allowedBranchIds.length === 0) {
    throw new ForbiddenException("User is not assigned to any active branch");
  }

  if (reqBranchStr) {
    if (!branchContext.allowedBranchIds.includes(reqBranchStr)) {
      throw new ForbiddenException("Cross-branch access denied: You do not have access to the requested branch");
    }
    return { [fieldName]: new mongoose.Types.ObjectId(reqBranchStr) };
  }

  return {
    [fieldName]: {
      $in: branchContext.allowedBranchIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
  };
}

export function assertBranchAccess(
  branchContext: IBranchScopeContext | undefined,
  targetBranchId?: string | mongoose.Types.ObjectId | null,
): mongoose.Types.ObjectId {
  if (!branchContext) {
    throw new ForbiddenException("Branch context is missing");
  }

  const resolvedId = targetBranchId?.toString() || branchContext.activeBranchId;
  if (!resolvedId || !mongoose.Types.ObjectId.isValid(resolvedId)) {
    throw new ForbiddenException("A valid branch is required for this operation");
  }

  if (!branchContext.isCentralAdmin && !branchContext.allowedBranchIds.includes(resolvedId)) {
    throw new ForbiddenException("Cross-branch access denied: Unauthorized branch");
  }

  return new mongoose.Types.ObjectId(resolvedId);
}
