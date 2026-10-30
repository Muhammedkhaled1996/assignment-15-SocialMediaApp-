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
const user_model_js_1 = require("../../DB/module/user.model.js");
const encryption_security_js_1 = require("./encryption.security.js");
const cache_service_js_1 = require("../service/cache.service.js");
const domain_exception_js_1 = require("../exception/domain.exception.js");
const user_repository_js_1 = require("../repository/user.repository.js");
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
    async detectSignatureLevel(isSystemOrAdmin) {
        return isSystemOrAdmin ? index_js_1.SignatureLevelEnum.Admin : index_js_1.SignatureLevelEnum.User;
    }
    async getSignatures(levelOrKey = index_js_1.SignatureLevelEnum.User) {
        const signatures = {
            access_signature: "",
            refresh_signature: "",
        };
        const isAdmin = levelOrKey === true ||
            levelOrKey === index_js_1.SignatureLevelEnum.Admin ||
            levelOrKey === "Admin" ||
            levelOrKey === "System";
        if (isAdmin) {
            signatures.access_signature = config_js_1.ACCESS_SYSTEM_TOKEN_SIGNATURE;
            signatures.refresh_signature = config_js_1.REFRESH_SYSTEM_TOKEN_SIGNATURE;
        }
        else {
            signatures.access_signature = config_js_1.ACCESS_USER_TOKEN_SIGNATURE;
            signatures.refresh_signature = config_js_1.REFRESH_USER_TOKEN_SIGNATURE;
        }
        return signatures;
    }
    async generateToken({ payload, secret = config_js_1.ACCESS_USER_TOKEN_SIGNATURE, options = { expiresIn: config_js_1.ACCESS_TOKEN_EXPIRES_IN }, }) {
        return jsonwebtoken_1.default.sign(payload, secret, options);
    }
    async verifyToken({ token, secret = config_js_1.ACCESS_USER_TOKEN_SIGNATURE, }) {
        return jsonwebtoken_1.default.verify(token, secret);
    }
    async createLoginCredentials(user, issuer = "SocialMediaApp") {
        const userRoles = user.role;
        const hasAdminPrivilege = userRoles == index_js_1.UserRole.admin || index_js_1.UserRole.superAdmin ? true : false;
        const signatureLevel = await this.detectSignatureLevel(hasAdminPrivilege);
        const signatures = await this.getSignatures(signatureLevel);
        const jwtid = (0, node_crypto_1.randomUUID)();
        const access_token = await this.generateToken({
            payload: { userRoles },
            secret: signatures.access_signature,
            options: {
                subject: user._id.toString(),
                expiresIn: config_js_1.ACCESS_TOKEN_EXPIRES_IN,
                jwtid,
                issuer,
            },
        });
        const refresh_token = await this.generateToken({
            payload: { userRoles },
            secret: signatures.refresh_signature,
            options: {
                subject: user._id.toString(),
                expiresIn: config_js_1.REFRESH_TOKEN_EXPIRES_IN,
                jwtid,
                issuer,
            },
        });
        return { access_token, refresh_token };
    }
    async decodeToken({ model = user_model_js_1.UserModel, authorization, tokenType = index_js_1.TokenEnum.Access, } = {}) {
        if (!authorization) {
            throw new domain_exception_js_1.UnauthorizedException("Authorization header is missing");
        }
        const [bearerKey, token] = authorization.split(" ");
        if (!bearerKey || !token) {
            throw new domain_exception_js_1.UnauthorizedException("missing token parts");
        }
        const payloadView = jsonwebtoken_1.default.decode(token);
        const signatures = await this.getSignatures(payloadView?.userRoles == index_js_1.UserRole.admin || index_js_1.UserRole.superAdmin ? true : false);
        const payload = await this.verifyToken({
            token,
            secret: tokenType === index_js_1.TokenEnum.Refresh ? signatures.refresh_signature : signatures.access_signature,
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
        if (user.changeCredentialsTime && user.changeCredentialsTime.getTime() > payload.iat * 1000) {
            throw new domain_exception_js_1.UnauthorizedException();
        }
        if (user.phone && user.phone.includes("::")) {
            user.phone = await (0, encryption_security_js_1.decryption)(user.phone);
        }
        return { user, payload };
    }
}
exports.TokenSecurityService = TokenSecurityService;
exports.tokenSecurityService = new TokenSecurityService();
