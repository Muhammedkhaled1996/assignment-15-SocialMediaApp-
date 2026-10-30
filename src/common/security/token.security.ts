import { randomUUID } from "node:crypto";
import jwt, { JwtPayload, SignOptions } from "jsonwebtoken";
import { SignatureLevelEnum, TokenEnum, UserRole } from "../enum/index.js";
import {
  ACCESS_SYSTEM_TOKEN_SIGNATURE,
  ACCESS_TOKEN_EXPIRES_IN,
  ACCESS_USER_TOKEN_SIGNATURE,
  REFRESH_SYSTEM_TOKEN_SIGNATURE,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_USER_TOKEN_SIGNATURE,
} from "../../config.js";
import { UserModel } from "../../DB/module/user.model.js";
import { decryption } from "./encryption.security.js";
import { IUser } from "../interface/user.interface.js";
import { cacheService, CacheService } from "../service/cache.service.js";
import { BadRequestException, NotFoundException, UnauthorizedException } from "../exception/domain.exception.js";
import { UserRepository } from "../repository/user.repository.js";

// ===================== Types & Interfaces =====================

export interface ICustomJwtPayload extends JwtPayload {
  userRoles?: number[];
  sub?: string;
  iat?: number;
  jti?: string;
}

export interface ISignatures {
  access_signature: string;
  refresh_signature: string;
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

// ===================== Token Security Service =====================

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

  // ===================== Revocation Handling =====================

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

  // ===================== Signatures =====================

  async detectSignatureLevel(isSystemOrAdmin: boolean): Promise<SignatureLevelEnum> {
    return isSystemOrAdmin ? SignatureLevelEnum.Admin : SignatureLevelEnum.User;
  }

  async getSignatures(
    levelOrKey: SignatureLevelEnum | string | boolean = SignatureLevelEnum.User,
  ): Promise<ISignatures> {
    const signatures: ISignatures = {
      access_signature: "",
      refresh_signature: "",
    };

    const isAdmin =
      levelOrKey === true ||
      levelOrKey === SignatureLevelEnum.Admin ||
      levelOrKey === "Admin" ||
      levelOrKey === "System";

    if (isAdmin) {
      signatures.access_signature = ACCESS_SYSTEM_TOKEN_SIGNATURE;
      signatures.refresh_signature = REFRESH_SYSTEM_TOKEN_SIGNATURE;
    } else {
      signatures.access_signature = ACCESS_USER_TOKEN_SIGNATURE;
      signatures.refresh_signature = REFRESH_USER_TOKEN_SIGNATURE;
    }

    return signatures;
  }

  // ===================== Token Sign & Verify =====================

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

  // ===================== Credentials & Decode =====================

  async createLoginCredentials(
    user: IUser & { _id: string },
    issuer: string = "SocialMediaApp",
  ): Promise<ILoginCredentials> {
    const userRoles = user.role;
    const hasAdminPrivilege = userRoles == UserRole.admin || UserRole.superAdmin ? true : false;
    const signatureLevel = await this.detectSignatureLevel(hasAdminPrivilege);
    const signatures = await this.getSignatures(signatureLevel);

    const jwtid = randomUUID();

    const access_token = await this.generateToken({
      payload: { userRoles },
      secret: signatures.access_signature,
      options: {
        subject: user._id.toString(),
        expiresIn: ACCESS_TOKEN_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
        jwtid,
        issuer,
      },
    });

    const refresh_token = await this.generateToken({
      payload: { userRoles },
      secret: signatures.refresh_signature,
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
    model = UserModel,
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

    const payloadView = jwt.decode(token) as ICustomJwtPayload | null;

    const signatures = await this.getSignatures(
      (payloadView?.userRoles as unknown as number) == UserRole.admin || UserRole.superAdmin ? true : false,
    );

    const payload = await this.verifyToken<ICustomJwtPayload>({
      token,
      secret: tokenType === TokenEnum.Refresh ? signatures.refresh_signature : signatures.access_signature,
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

    if (user.changeCredentialsTime && user.changeCredentialsTime.getTime() > payload.iat * 1000) {
      throw new UnauthorizedException();
    }

    if (user.phone && user.phone.includes("::")) {
      user.phone = await decryption(user.phone);
    }

    return { user, payload };
  }
}

export const tokenSecurityService = new TokenSecurityService();
