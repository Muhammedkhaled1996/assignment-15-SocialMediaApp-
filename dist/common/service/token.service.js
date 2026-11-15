"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenSecurityService = exports.TokenSecurityService = void 0;
const node_crypto_1 = require("node:crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_js_1 = require("../enum/index.js");
const config_js_1 = require("../../config.js");
const cache_service_js_1 = require("./cache.service.js");
const domain_exception_js_1 = require("../exception/domain.exception.js");
const user_repository_js_1 = require("../repository/user.repository.js");
const encryption_security_js_1 = require("../security/encryption.security.js");
class TokenSecurityService {
    cacheService;
    userRepository;
    constructor() {
        this.cacheService = cache_service_js_1.cacheService;
        this.userRepository = new user_repository_js_1.UserRepository();
    }
    userBaseKey({ userId }) {
        return `User::${userId.toString()}`;
    }
    userBaseRevokeTokenKey({ userId }) {
        return `${this.userBaseKey({ userId })}::Revoke_Token`;
    }
    userRevokeTokenKey({ userId, jti }) {
        return `${this.userBaseRevokeTokenKey({ userId })}::${jti}`;
    }
    async createRevokeToken({ payload }) {
        if (!payload.iat || !payload.sub || !payload.jti)
            return;
        const currentTime = Math.floor(Date.now() / 1000);
        const expiryTime = payload.iat + Number(config_js_1.REFRESH_TOKEN_EXPIRES_IN);
        const ttl = expiryTime - currentTime;
        if (ttl <= 0)
            return;
        await this.cacheService.set({
            key: this.userRevokeTokenKey({ userId: payload.sub, jti: payload.jti }),
            value: payload.jti,
            ttl: Math.ceil(ttl),
        });
    }
    async generateToken({ payload, secret = config_js_1.ACCESS_USER_TOKEN_SIGNATURE, options = { expiresIn: config_js_1.ACCESS_TOKEN_EXPIRES_IN }, }) {
        return jsonwebtoken_1.default.sign(payload, secret, options);
    }
    async verifyToken({ token, secret = config_js_1.ACCESS_USER_TOKEN_SIGNATURE, }) {
        return jsonwebtoken_1.default.verify(token, secret);
    }
    async createLoginCredentials(user, issuer = "TrozianaERP") {
        const jwtid = (0, node_crypto_1.randomUUID)();
        const roleNumber = user.roleNumber || index_js_1.UserRole.EMPLOYEE;
        const access_token = await this.generateToken({
            payload: { roleNumber },
            secret: config_js_1.ACCESS_USER_TOKEN_SIGNATURE,
            options: {
                subject: user._id.toString(),
                expiresIn: config_js_1.ACCESS_TOKEN_EXPIRES_IN,
                jwtid,
                issuer,
            },
        });
        const refresh_token = await this.generateToken({
            payload: { roleNumber },
            secret: config_js_1.REFRESH_USER_TOKEN_SIGNATURE,
            options: {
                subject: user._id.toString(),
                expiresIn: config_js_1.REFRESH_TOKEN_EXPIRES_IN,
                jwtid,
                issuer,
            },
        });
        return { access_token, refresh_token };
    }
    async decodeToken({ authorization, tokenType = index_js_1.TokenEnum.Access, } = {}) {
        if (!authorization) {
            throw new domain_exception_js_1.UnauthorizedException("Authorization header is missing");
        }
        const [bearerKey, token] = authorization.split(" ");
        if (!bearerKey || !token) {
            throw new domain_exception_js_1.UnauthorizedException("missing token parts");
        }
        const payload = await this.verifyToken({
            token,
            secret: tokenType === index_js_1.TokenEnum.Refresh ? config_js_1.REFRESH_USER_TOKEN_SIGNATURE : config_js_1.ACCESS_USER_TOKEN_SIGNATURE,
        });
        if (!payload?.sub || !payload?.iat) {
            throw new domain_exception_js_1.BadRequestException("invalid token payload");
        }
        if (payload.jti) {
            const isRevoked = await this.cacheService.exists({
                key: this.userRevokeTokenKey({ userId: payload.sub, jti: payload.jti }),
            });
            if (isRevoked) {
                throw new domain_exception_js_1.UnauthorizedException();
            }
        }
        const user = await this.userRepository.findOne({
            filter: { _id: payload.sub },
        });
        if (!user) {
            throw new domain_exception_js_1.NotFoundException("Not registered account");
        }
        if (user.isActive === false || (user.accountStatus && user.accountStatus !== "ACTIVE")) {
            throw new domain_exception_js_1.ForbiddenException(`Account is deactivated (${user.accountStatus || "INACTIVE"})`);
        }
        if (user.changeCredentialsTime && Math.floor(user.changeCredentialsTime.getTime() / 1000) > payload.iat) {
            throw new domain_exception_js_1.UnauthorizedException("Session expired due to security or role update. Please log in again.");
        }
        if (user.phone && user.phone.includes("::")) {
            user.phone = await (0, encryption_security_js_1.decryption)(user.phone);
        }
        return { user, payload };
    }
}
exports.TokenSecurityService = TokenSecurityService;
exports.tokenSecurityService = new TokenSecurityService();
