"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationService = void 0;
const node_crypto_1 = require("node:crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const exception_1 = require("../../common/exception");
const repository_1 = require("../../common/repository");
const service_1 = require("../../common/service");
const security_1 = require("../../common/security");
const utils_1 = require("../../common/utils");
const enum_1 = require("../../common/enum");
const config_1 = require("../../config");
const module_1 = require("../../DB/module");
const authentication_middleware_1 = require("../../middleware/authentication.middleware");
class AuthenticationService {
    userRepository;
    cacheService;
    token;
    constructor() {
        this.userRepository = new repository_1.UserRepository();
        this.cacheService = service_1.cacheService;
        this.token = service_1.tokenSecurityService;
    }
    async login(inputs, issuer, meta) {
        const { email, password } = inputs;
        const user = await this.userRepository.findOne({
            filter: { email: email.toLowerCase().trim() },
        });
        if (!user) {
            throw new exception_1.NotFoundException("Invalid credentials");
        }
        if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
            const waitSeconds = Math.ceil((user.lockUntil.getTime() - Date.now()) / 1000);
            throw new exception_1.TooManyRequestException(`Account temporarily locked due to failed login attempts. Try again in ${waitSeconds}s`);
        }
        if (user.isActive === false || (user.accountStatus && user.accountStatus !== enum_1.UserAccountStatus.ACTIVE)) {
            throw new exception_1.ForbiddenException(`Account is currently deactivated (${user.accountStatus || "INACTIVE"})`);
        }
        const cipherPassword = user.password;
        const match = await (0, security_1.compared)({
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
            throw new exception_1.NotFoundException("Invalid credentials");
        }
        user.failedLoginAttempts = 0;
        user.lockUntil = null;
        user.lastLoginAt = new Date();
        await user.save();
        await this.cacheService.del({ key: [(0, utils_1.UserLoginTrailsKey)({ email, subject: "LOGIN" })] });
        const { access_token, refresh_token } = await this.token.createLoginCredentials(user, issuer);
        const decodedRefresh = jsonwebtoken_1.default.decode(refresh_token);
        const jti = decodedRefresh?.jti || (0, node_crypto_1.randomUUID)();
        const familyId = (0, node_crypto_1.randomUUID)();
        await module_1.UserSessionModel.create({
            userId: user._id,
            jti,
            familyId,
            refreshTokenHash: await (0, security_1.hashed)({ plainText: refresh_token }),
            userAgent: meta?.userAgent,
            ipAddress: meta?.ipAddress,
            isRevoked: false,
            expiresAt: new Date(Date.now() + Number(config_1.REFRESH_TOKEN_EXPIRES_IN) * 1000),
            lastUsedAt: new Date(),
        });
        const roleNumber = user.roleNumber || enum_1.UserRole.EMPLOYEE;
        const roleName = enum_1.USER_ROLE_LABELS[roleNumber] || "EMPLOYEE";
        const branchContext = (0, authentication_middleware_1.resolveBranchContext)(user);
        await service_1.auditService.record({
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
        delete userObj.password;
        return {
            access_token,
            refresh_token,
            user: userObj,
            roleNumber,
            roleName,
            branchContext,
        };
    }
    async rotateToken(payload, user, rawRefreshToken, issuer = "TrozianaERP", forceRotate = false) {
        if (!forceRotate && payload?.iat) {
            const accessExpiresIn = (payload.iat + config_1.ACCESS_TOKEN_EXPIRES_IN) * 1000;
            const currentTime = Date.now() + 5 * 60000;
            if (currentTime < accessExpiresIn && !rawRefreshToken) {
                throw new exception_1.ConflictException("Sorry we cannot create new login credentials while current access token still within valid time range");
            }
        }
        const oldJti = payload?.jti;
        let familyId = (0, node_crypto_1.randomUUID)();
        if (oldJti) {
            const existingSession = await module_1.UserSessionModel.findOne({ jti: oldJti });
            if (existingSession) {
                familyId = existingSession.familyId;
                if (existingSession.isRevoked) {
                    await module_1.UserSessionModel.updateMany({ familyId: existingSession.familyId }, { $set: { isRevoked: true, revokedReason: "REFRESH_TOKEN_REUSE_DETECTED", revokedAt: new Date() } });
                    await this.token.createRevokeToken({ payload });
                    throw new exception_1.UnauthorizedException("Refresh token reuse detected. All sessions in this family have been revoked.");
                }
            }
        }
        const { access_token, refresh_token } = await this.token.createLoginCredentials(user, issuer);
        await this.token.createRevokeToken({ payload });
        const newDecoded = jsonwebtoken_1.default.decode(refresh_token);
        const newJti = newDecoded?.jti || (0, node_crypto_1.randomUUID)();
        if (oldJti) {
            await module_1.UserSessionModel.updateOne({ jti: oldJti }, {
                $set: {
                    isRevoked: true,
                    revokedReason: "ROTATED",
                    revokedAt: new Date(),
                    replacedByJti: newJti,
                },
            });
        }
        await module_1.UserSessionModel.create({
            userId: user._id,
            jti: newJti,
            familyId,
            refreshTokenHash: await (0, security_1.hashed)({ plainText: refresh_token }),
            isRevoked: false,
            expiresAt: new Date(Date.now() + Number(config_1.REFRESH_TOKEN_EXPIRES_IN) * 1000),
            lastUsedAt: new Date(),
        });
        return { access_token, refresh_token };
    }
    async changePassword(user, inputs) {
        const match = await (0, security_1.compared)({
            ciperText: user.password,
            plainText: inputs.currentPassword,
        });
        if (!match) {
            throw new exception_1.BadRequestException("Current password is incorrect");
        }
        user.password = await (0, security_1.hashed)({ plainText: inputs.newPassword });
        user.changeCredentialsTime = new Date();
        await user.save();
        await module_1.UserSessionModel.updateMany({ userId: user._id, isRevoked: false }, { $set: { isRevoked: true, revokedReason: "PASSWORD_CHANGED", revokedAt: new Date() } });
        await service_1.auditService.record({
            actorId: user._id,
            actorEmail: user.email,
            action: "AUTH_CHANGE_PASSWORD",
            module: "auth",
            entityType: "User",
            entityId: user._id.toString(),
        });
        return { message: "Password changed successfully" };
    }
    async listSessions(userId) {
        return await module_1.UserSessionModel.find({
            userId,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
        })
            .select("-refreshTokenHash")
            .sort({ lastUsedAt: -1 })
            .lean();
    }
    async revokeSession(userId, sessionId) {
        const session = await module_1.UserSessionModel.findOne({ _id: sessionId, userId });
        if (!session) {
            throw new exception_1.NotFoundException("Session not found");
        }
        session.isRevoked = true;
        session.revokedReason = "USER_REVOKED";
        session.revokedAt = new Date();
        await session.save();
        await this.cacheService.set({
            key: this.token.userRevokeTokenKey({ userId, jti: session.jti }),
            value: session.jti,
            ttl: Number(config_1.REFRESH_TOKEN_EXPIRES_IN),
        });
        return { message: "Session revoked successfully" };
    }
    async logout(payload, user, inputs = {}) {
        const action = inputs?.action ?? enum_1.LogoutEnum.DEVICE;
        switch (action) {
            case enum_1.LogoutEnum.ALL:
                user.changeCredentialsTime = new Date();
                await user.save();
                await module_1.UserSessionModel.updateMany({ userId: user._id, isRevoked: false }, { $set: { isRevoked: true, revokedReason: "LOGOUT_ALL", revokedAt: new Date() } });
                const keysCount = await this.cacheService.keys({
                    prefix: this.token.userBaseRevokeTokenKey({ userId: payload.sub }),
                });
                if (keysCount && keysCount.length > 0) {
                    await this.cacheService.del({ key: keysCount });
                }
                break;
            default:
                await this.token.createRevokeToken({ payload });
                if (payload.jti) {
                    await module_1.UserSessionModel.updateOne({ jti: payload.jti }, { $set: { isRevoked: true, revokedReason: "LOGOUT", revokedAt: new Date() } });
                }
                break;
        }
    }
}
exports.AuthenticationService = AuthenticationService;
exports.default = new AuthenticationService();
