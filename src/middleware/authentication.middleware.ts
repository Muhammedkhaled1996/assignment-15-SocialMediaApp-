import { TokenEnum } from "../common/enum/TokenEnum.js";
import type { NextFunction, Request, Response } from "express";
import { TokenSecurityService } from "../common/security/token.security.js";
import { ForbiddenException } from "../common/exception/domain.exception.js";

const tokenSecurityService = new TokenSecurityService();

export const bearerAuth = async ({ req, tokenType = TokenEnum.Access }: { req: Request; tokenType: TokenEnum }) => {
  const { authorization } = req.headers;
  const { user, payload } = await tokenSecurityService.decodeToken({ authorization, tokenType });
  req.user = user;
  req.payload = payload;
};

export const authentication = (tokenType = TokenEnum.Access) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { authorization } = req.headers;

    await bearerAuth({ req, tokenType });

    next();
  };
};

export const authorization = (userRole: number) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const userPrivileges = user?.role;

    const hasPermission = userPrivileges !== undefined && userPrivileges >= userRole;

    if (!hasPermission) {
      throw new ForbiddenException("Forbidden: Access Denied");
    }
    next();
  };
};
