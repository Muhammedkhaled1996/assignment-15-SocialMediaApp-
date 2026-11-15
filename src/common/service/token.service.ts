import { randomUUID } from "node:crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { TokenEnum, UserRole } from "../enum/index.js";
import {
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_USER_TOKEN_SIGNATURE,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_USER_TOKEN_SIGNATURE,
} from "../../config.js";
import { UserModel } from "../../DB/module/user.model.js";
import { IUser } from "../interface/user.interface.js";
import { cacheService, CacheService } from "./cache.service.js";
import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "../exception/domain.exception.js";
import { UserRepository } from "../repository/user.repository.js";
import { decryption } from "../security/encryption.security.js";

export interface ICustomJwtPayload extends JwtPayload {
  roleNumber?: UserRole;
  sub?: string;
  iat?: number;
  jti?: string;
}

export interface IGenerateTokenOptions {
  payload: object;
  secret?: string;
  options?: SignOptions;
}

export interface IVerifyTokenOptions {
  token: string;
  secret?: string;
}

export interface IDecodeTokenOptions {
  model?: typeof UserModel;
  authorization?: string | undefined;
  tokenType?: TokenEnum;
}

export interface ILoginCredentials {
  access_token: string;
  refresh_token: string;
}

export class TokenSecurityService {
  private cacheService: CacheService;
  private userRepository: UserRepository;
  constructor() {
    this.cacheService = cacheService;
    this.userRepository = new UserRepository();
  }

  userBaseKey({ userId }: { userId: string }): string {
    return `User::${userId.toString()}`;
  }

  userBaseRevokeTokenKey({ userId }: { userId: string }): string {
    return `${this.userBaseKey({ userId })}::Revoke_Token`;
  }

  userRevokeTokenKey({ userId, jti }: { userId: string; jti: string }): string {
    return `${this.userBaseRevokeTokenKey({ userId })}::${jti}`;
  }

  async createRevokeToken({ payload }: { payload: ICustomJwtPayload }): Promise<void> {
    if (!payload.iat || !payload.sub || !payload.jti) return;

    const currentTime = Math.floor(Date.now() / 1000);
    const expiryTime = payload.iat + Number(REFRESH_TOKEN_EXPIRES_IN);
    const ttl = expiryTime - currentTime;

    if (ttl <= 0) return;

    await this.cacheService.set({
      key: this.userRevokeTokenKey({ userId: payload.sub, jti: payload.jti }),
      value: payload.jti,
      ttl: Math.ceil(ttl),
    });
  }

  async generateToken({
    payload,
    secret = ACCESS_USER_TOKEN_SIGNATURE,
    options = { expiresIn: ACCESS_TOKEN_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]> },
  }: IGenerateTokenOptions): Promise<string> {
    return jwt.sign(payload, secret, options);
  }

  async verifyToken<T extends object = ICustomJwtPayload>({
    token,
    secret = ACCESS_USER_TOKEN_SIGNATURE,
  }: IVerifyTokenOptions): Promise<T> {
    return jwt.verify(token, secret) as T;
  }

  async createLoginCredentials(
    user: IUser & { _id: string },
    issuer: string = "TrozianaERP",
  ): Promise<ILoginCredentials> {
    const jwtid = randomUUID();
    const roleNumber = user.roleNumber || UserRole.EMPLOYEE;

    const access_token = await this.generateToken({
      payload: { roleNumber },
      secret: ACCESS_USER_TOKEN_SIGNATURE,
      options: {
        subject: user._id.toString(),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
        jwtid,
        issuer,
      },
    });

    const refresh_token = await this.generateToken({
      payload: { roleNumber },
      secret: REFRESH_USER_TOKEN_SIGNATURE,
      options: {
        subject: user._id.toString(),
        expiresIn: REFRESH_TOKEN_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
        jwtid,
        issuer,
      },
    });

    return { access_token, refresh_token };
  }

  async decodeToken({
    authorization,
    tokenType = TokenEnum.Access,
  }: IDecodeTokenOptions = {}): Promise<{ user: IUser; payload: ICustomJwtPayload }> {
    if (!authorization) {
      throw new UnauthorizedException("Authorization header is missing");
    }

    const [bearerKey, token] = authorization.split(" ");
    if (!bearerKey || !token) {
      throw new UnauthorizedException("missing token parts");
    }

    const payload = await this.verifyToken<ICustomJwtPayload>({
      token,
      secret: tokenType === TokenEnum.Refresh ? REFRESH_USER_TOKEN_SIGNATURE : ACCESS_USER_TOKEN_SIGNATURE,
    });

    if (!payload?.sub || !payload?.iat) {
      throw new BadRequestException("invalid token payload");
    }

    if (payload.jti) {
      const isRevoked = await this.cacheService.exists({
        key: this.userRevokeTokenKey({ userId: payload.sub, jti: payload.jti }),
      });

      if (isRevoked) {
        throw new UnauthorizedException();
      }
    }

    const user: IUser | null = await this.userRepository.findOne({
      filter: { _id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException("Not registered account");
    }

    if (user.isActive === false || (user.accountStatus && user.accountStatus !== "ACTIVE")) {
      throw new ForbiddenException(`Account is deactivated (${user.accountStatus || "INACTIVE"})`);
    }

    if (user.changeCredentialsTime && Math.floor(user.changeCredentialsTime.getTime() / 1000) > payload.iat) {
      throw new UnauthorizedException("Session expired due to security or role update. Please log in again.");
    }

    if (user.phone && user.phone.includes("::")) {
      user.phone = await decryption(user.phone);
    }

    return { user, payload };
  }
}

export const tokenSecurityService = new TokenSecurityService();
