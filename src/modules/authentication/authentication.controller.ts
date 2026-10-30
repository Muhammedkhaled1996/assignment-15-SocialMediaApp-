import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import authenticationService from "./authentication.service";
import { authentication, responceFormatter, validation } from "../../middleware";
import { IResponse } from "../../common/interface";
import * as validators from "./authentication.validation";
import { rateLimiterService } from "../../common/utils";
import { TokenEnum } from "../../common/enum";
import { HUser } from "../../DB/module";
import { cacheService } from "../../common/service";

const router = Router({ caseSensitive: true, strict: true });

// signup with system
router.post(
  "/signup",
  validation(validators.signup),

  responceFormatter(
    async (req: Request, res: Response, next: NextFunction): Promise<IResponse<{ message: string }>> => {
      const data = await authenticationService.signup(req.validate.body, `${req.protocol}://${req.host}`);
      return { status: 201, data };
    },
  ),
);

// confirm email
router.patch(
  "/confirm-email",
  validation(validators.confirmEmail),

  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = await authenticationService.confirmEmail(req.validate.body);
  }),
);

// resend otp email
router.patch(
  "/resend-otp",
  validation(validators.resendOtp),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = await authenticationService.resendEmail(req.validate.body);
  }),
);

// login with system
const loginLimiter = rateLimiterService.generateLimiter({ limit: 5, ttl: 5, skipSuccessfulRequests: true });

router.post(
  "/login",
  loginLimiter,
  validation(validators.login),

  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.login(req.validate.body, `${req.protocol}://${req.host}`);
    if (req.rateLimit?.key) await cacheService.del({ key: req.rateLimit.key });
    return { data };
  }),
);

// rotate-token
router.post(
  "/rotate-token",
  authentication(TokenEnum.Refresh),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.rotateToken(req.payload, req.user);
    return { data };
  }),
);

// sigin with gmail
router.post(
  "/sigup-with-gmail",
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<object>> => {
    const { status, data } = await authenticationService.siginUpWithGmail(req.body, `${req.protocol}://${req.host}`);
    return { data, status };
  }),
);

// logout
router.post(
  "/logout",
  validation(validators.logoutSchema),
  authentication(),
  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = await authenticationService.logout(req.payload, req.user as HUser, req.validate.body);
  }),
);

// forget password
router.post(
  "/requset-forgot-password-code",
  validation(validators.resendOtp),

  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const data = await authenticationService.requestForgetPasswordCode(req.validate.body);
  }),
);

// verify forgot password
router.patch(
  "/verify-forgot-password",
  validation(validators.confirmEmail),

  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.verifyForgotPasswordCode(req.validate.body);
    return { data };
  }),
);

// reset password
router.patch(
  "/reset-password",
  validation(validators.resetPassword),

  responceFormatter(async (req: Request, res: Response, next: NextFunction): Promise<IResponse<object>> => {
    const data = await authenticationService.resetPasswordCode(req.validate.body);
    return { data };
  }),
);

export default router;
