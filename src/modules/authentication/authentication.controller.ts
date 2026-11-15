import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import authenticationService from "./authentication.service";
import { authentication, responceFormatter, validation } from "../../middleware";
import { IResponse } from "../../common/interface";
import * as validators from "./authentication.validation";
import { rateLimiterService } from "../../common/utils";
import { TokenEnum, USER_ROLE_LABELS, UserRole } from "../../common/enum";
import { HUser } from "../../DB/module";
import { cacheService } from "../../common/service";
import { getIssuer } from "../../common/utils/issuer";
import { ACCESS_TOKEN_EXPIRES_IN, COOKIE_DOMAIN, NODE_ENV, REFRESH_TOKEN_EXPIRES_IN } from "../../config";

const router = Router({ caseSensitive: true, strict: true });

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    domain: isProd ? COOKIE_DOMAIN : undefined,
    maxAge: ACCESS_TOKEN_EXPIRES_IN * 1000,
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    domain: isProd ? COOKIE_DOMAIN : undefined,
    maxAge: REFRESH_TOKEN_EXPIRES_IN * 1000,
  });
}

// login
// const loginLimiter = rateLimiterService.generateLimiter({ limit: 10, ttl: 5, skipSuccessfulRequests: true });

router.post(
  "/login",
  // loginLimiter,
  validation(validators.login),
  responceFormatter(async (req: Request, res: Response, _next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.login(req.validate.body, getIssuer(req), {
      ipAddress: req.ip || req.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
    });
    if (req.rateLimit?.key) await cacheService.del({ key: req.rateLimit.key });
    setAuthCookies(res, data.access_token, data.refresh_token);
    return { data };
  }),
);

// refresh token with rotation and reuse detection
router.post(
  "/refresh-token",
  authentication(TokenEnum.Refresh),
  responceFormatter(async (req: Request, res: Response, _next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.rotateToken(req.payload, req.user, "refresh", getIssuer(req), true);
    setAuthCookies(res, data.access_token, data.refresh_token);
    return { data };
  }),
);

// current authenticated user & branch context
router.get(
  "/me",
  authentication(),
  responceFormatter(async (req: Request): Promise<IResponse<object>> => {
    const roleNumber = req.user.roleNumber as UserRole;
    return {
      data: {
        user: req.user,
        roleNumber,
        roleName: USER_ROLE_LABELS[roleNumber] || "EMPLOYEE",
        branchContext: req.branchContext,
      },
    };
  }),
);

// change password (authenticated user changing own password)
router.patch(
  "/change-password",
  authentication(),
  validation(validators.changePassword),
  responceFormatter(async (req: Request): Promise<IResponse<object>> => {
    const data = await authenticationService.changePassword(req.user as HUser, req.validate.body);
    return { data };
  }),
);

// list active sessions
router.get(
  "/sessions",
  authentication(),
  responceFormatter(async (req: Request): Promise<IResponse<object>> => {
    const data = await authenticationService.listSessions(req.user._id!.toString());
    return { data };
  }),
);

// revoke session
router.delete(
  "/sessions/:sessionId",
  authentication(),
  responceFormatter(async (req: Request): Promise<IResponse<object>> => {
    const data = await authenticationService.revokeSession(req.user._id!.toString(), req.params.sessionId as string);
    return { data };
  }),
);

// logout
router.post(
  "/logout",
  validation(validators.logoutSchema),
  authentication(),
  responceFormatter(async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    await authenticationService.logout(req.payload, req.user as HUser, req.validate.body);
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
  }),
);

export default router;
