import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { IUser } from "../../common/interface/user.interface";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  TooManyRequestException,
  UnauthorizedException,
} from "../../common/exception";
import { UserRepository } from "../../common/repository";
import {
  auditService,
  cacheService,
  CacheService,
  ICustomJwtPayload,
  tokenSecurityService,
  TokenSecurityService,
} from "../../common/service";
import { compared, hashed } from "../../common/security";
import { UserLoginTrailsKey } from "../../common/utils";
import { LogoutEnum, USER_ROLE_LABELS, UserAccountStatus, UserRole } from "../../common/enum";
import { ACCESS_TOKEN_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN } from "../../config";
import { LoginDto } from "./dto/authentication.dto";
import { HUser, UserSessionModel } from "../../DB/module";
import { resolveBranchContext } from "../../middleware/authentication.middleware";

export class AuthenticationService {
  private userRepository: UserRepository;
  private cacheService: CacheService;
  private token: TokenSecurityService;
  constructor() {
    this.userRepository = new UserRepository();
    this.cacheService = cacheService;
    this.token = tokenSecurityService;
  }

  async login(
    inputs: LoginDto["body"],
    issuer: string,
    meta?: { ipAddress?: string | undefined; userAgent?: string | undefined },
  ): Promise<{
    access_token: string;
    refresh_token: string;
    user: Record<string, any>;
    roleNumber: UserRole;
    roleName: string;
    branchContext: any;
  }> {
    const { email, password } = inputs;

    const user = await this.userRepository.findOne({
      filter: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException("Invalid credentials");
    }

    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      const waitSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
      throw new TooManyRequestException(`Account temporarily locked due to failed login attempts. Try again in ${waitSeconds}s`);
    }

    if (user.isActive === false || (user.accountStatus && user.accountStatus !== UserAccountStatus.ACTIVE)) {
      throw new ForbiddenException(`Account is currently deactivated (${user.accountStatus || "INACTIVE"})`);
    }

    const cipherPassword = user.password;

    const match = await compared({
      ciperText: cipherPassword,
      plainText: password,
    });

    if (!match) {
      const attempts = (user.failedLoginAttempts || 0) + 1;
      user.failedLoginAttempts = attempts;
      if (attempts >= 5) {
        user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      await user.save();
      throw new NotFoundException("Invalid credentials");
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    await this.cacheService.del({ key: [UserLoginTrailsKey({ email, subject: "LOGIN" })] });

    const { access_token, refresh_token } = await this.token.createLoginCredentials(
      user as unknown as IUser & { _id: string },
      issuer,
    );

    const decodedRefresh = jwt.decode(refresh_token) as ICustomJwtPayload | null;
    const jti = decodedRefresh?.jti || randomUUID();
    const familyId = randomUUID();

    await UserSessionModel.create({
      userId: user._id!,
      jti,
      familyId,
      refreshTokenHash: await hashed({ plainText: refresh_token }),
      userAgent: meta?.userAgent,
      ipAddress: meta?.ipAddress,
      isRevoked: false,
      expiresAt: new Date(Date.now() + Number(REFRESH_TOKEN_EXPIRES_IN) * 1000),
      lastUsedAt: new Date(),
    });

    const roleNumber = (user.roleNumber as UserRole) || UserRole.EMPLOYEE;
    const roleName = USER_ROLE_LABELS[roleNumber] || "EMPLOYEE";
    const branchContext = resolveBranchContext(user);

    await auditService.record({
      actorId: user._id,
      actorEmail: user.email,
      actorRoles: [roleName],
      action: "AUTH_LOGIN",
      module: "auth",
      entityType: "User",
      entityId: user._id?.toString(),
      branchId: user.branchId || user.primaryBranchId,
      metadata: { ipAddress: meta?.ipAddress, userAgent: meta?.userAgent },
    });

    const userObj = user.toObject();
    delete (userObj as any).password;

    return {
      access_token,
      refresh_token,
      user: userObj,
      roleNumber,
      roleName,
      branchContext,
    };
  }

  async rotateToken(
    payload: any,
    user: IUser,
    rawRefreshToken?: string,
    issuer: string = "TrozianaERP",
    forceRotate: boolean = false,
  ): Promise<{ access_token: string; refresh_token: string }> {
    if (!forceRotate && payload?.iat) {
      const accessExpiresIn = (payload.iat + ACCESS_TOKEN_EXPIRES_IN) * 1000;
      const currentTime = Date.now() + 5 * 60000;
      if (currentTime < accessExpiresIn && !rawRefreshToken) {
        throw new ConflictException(
          "Sorry we cannot create new login credentials while current access token still within valid time range",
        );
      }
    }

    const oldJti = payload?.jti;
    let familyId: string = randomUUID();

    if (oldJti) {
      const existingSession = await UserSessionModel.findOne({ jti: oldJti });
      if (existingSession) {
        familyId = existingSession.familyId;
        if (existingSession.isRevoked) {
          await UserSessionModel.updateMany(
            { familyId: existingSession.familyId },
            { $set: { isRevoked: true, revokedReason: "REFRESH_TOKEN_REUSE_DETECTED", revokedAt: new Date() } },
          );
          await this.token.createRevokeToken({ payload });
          throw new UnauthorizedException("Refresh token reuse detected. All sessions in this family have been revoked.");
        }
      }
    }

    const { access_token, refresh_token } = await this.token.createLoginCredentials(
      user as IUser & { _id: string },
      issuer,
    );
    await this.token.createRevokeToken({ payload });

    const newDecoded = jwt.decode(refresh_token) as ICustomJwtPayload | null;
    const newJti = newDecoded?.jti || randomUUID();

    if (oldJti) {
      await UserSessionModel.updateOne(
        { jti: oldJti },
        {
          $set: {
            isRevoked: true,
            revokedReason: "ROTATED",
            revokedAt: new Date(),
            replacedByJti: newJti,
          },
        },
      );
    }

    await UserSessionModel.create({
      userId: user._id!,
      jti: newJti,
      familyId,
      refreshTokenHash: await hashed({ plainText: refresh_token }),
      isRevoked: false,
      expiresAt: new Date(Date.now() + Number(REFRESH_TOKEN_EXPIRES_IN) * 1000),
      lastUsedAt: new Date(),
    });

    return { access_token, refresh_token };
  }

  async changePassword(
    user: HUser,
    inputs: { currentPassword: string; newPassword: string },
  ): Promise<{ message: string }> {
    const match = await compared({
      ciperText: user.password,
      plainText: inputs.currentPassword,
    });
    if (!match) {
      throw new BadRequestException("Current password is incorrect");
    }

    user.password = await hashed({ plainText: inputs.newPassword });
    user.changeCredentialsTime = new Date();
    await user.save();

    await UserSessionModel.updateMany(
      { userId: user._id, isRevoked: false },
      { $set: { isRevoked: true, revokedReason: "PASSWORD_CHANGED", revokedAt: new Date() } },
    );

    await auditService.record({
      actorId: user._id,
      actorEmail: user.email,
      action: "AUTH_CHANGE_PASSWORD",
      module: "auth",
      entityType: "User",
      entityId: user._id.toString(),
    });

    return { message: "Password changed successfully" };
  }

  async listSessions(userId: string) {
    return await UserSessionModel.find({
      userId,
      isRevoked: false,
      expiresAt: { $gt: new Date() },
    })
      .select("-refreshTokenHash")
      .sort({ lastUsedAt: -1 })
      .lean();
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await UserSessionModel.findOne({ _id: sessionId, userId });
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    session.isRevoked = true;
    session.revokedReason = "USER_REVOKED";
    session.revokedAt = new Date();
    await session.save();

    await this.cacheService.set({
      key: this.token.userRevokeTokenKey({ userId, jti: session.jti }),
      value: session.jti,
      ttl: Number(REFRESH_TOKEN_EXPIRES_IN),
    });

    return { message: "Session revoked successfully" };
  }

  async logout(payload: ICustomJwtPayload, user: HUser, inputs: { action?: number } = {}): Promise<void> {
    const action = inputs?.action ?? LogoutEnum.DEVICE;

    switch (action) {
      case LogoutEnum.ALL:
        user.changeCredentialsTime = new Date();
        await user.save();
        await UserSessionModel.updateMany(
          { userId: user._id, isRevoked: false },
          { $set: { isRevoked: true, revokedReason: "LOGOUT_ALL", revokedAt: new Date() } },
        );
        const keysCount = await this.cacheService.keys({
          prefix: this.token.userBaseRevokeTokenKey({ userId: payload.sub! }),
        });

        if (keysCount && keysCount.length > 0) {
          await this.cacheService.del({ key: keysCount });
        }
        break;

      default:
        await this.token.createRevokeToken({ payload });
        if (payload.jti) {
          await UserSessionModel.updateOne(
            { jti: payload.jti },
            { $set: { isRevoked: true, revokedReason: "LOGOUT", revokedAt: new Date() } },
          );
        }
        break;
    }
  }
}

export default new AuthenticationService();
