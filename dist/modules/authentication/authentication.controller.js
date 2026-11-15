"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authentication_service_1 = __importDefault(require("./authentication.service"));
const middleware_1 = require("../../middleware");
const validators = __importStar(require("./authentication.validation"));
const enum_1 = require("../../common/enum");
const service_1 = require("../../common/service");
const issuer_1 = require("../../common/utils/issuer");
const config_1 = require("../../config");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
function setAuthCookies(res, accessToken, refreshToken) {
    const isProd = config_1.NODE_ENV === "production";
    res.cookie("access_token", accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        domain: isProd ? config_1.COOKIE_DOMAIN : undefined,
        maxAge: config_1.ACCESS_TOKEN_EXPIRES_IN * 1000,
    });
    res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: "lax",
        domain: isProd ? config_1.COOKIE_DOMAIN : undefined,
        maxAge: config_1.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });
}
router.post("/login", (0, middleware_1.validation)(validators.login), (0, middleware_1.responceFormatter)(async (req, res, _next) => {
    const data = await authentication_service_1.default.login(req.validate.body, (0, issuer_1.getIssuer)(req), {
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers["user-agent"],
    });
    if (req.rateLimit?.key)
        await service_1.cacheService.del({ key: req.rateLimit.key });
    setAuthCookies(res, data.access_token, data.refresh_token);
    return { data };
}));
router.post("/refresh-token", (0, middleware_1.authentication)(enum_1.TokenEnum.Refresh), (0, middleware_1.responceFormatter)(async (req, res, _next) => {
    const data = await authentication_service_1.default.rotateToken(req.payload, req.user, "refresh", (0, issuer_1.getIssuer)(req), true);
    setAuthCookies(res, data.access_token, data.refresh_token);
    return { data };
}));
router.get("/me", (0, middleware_1.authentication)(), (0, middleware_1.responceFormatter)(async (req) => {
    const roleNumber = req.user.roleNumber;
    return {
        data: {
            user: req.user,
            roleNumber,
            roleName: enum_1.USER_ROLE_LABELS[roleNumber] || "EMPLOYEE",
            branchContext: req.branchContext,
        },
    };
}));
router.patch("/change-password", (0, middleware_1.authentication)(), (0, middleware_1.validation)(validators.changePassword), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await authentication_service_1.default.changePassword(req.user, req.validate.body);
    return { data };
}));
router.get("/sessions", (0, middleware_1.authentication)(), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await authentication_service_1.default.listSessions(req.user._id.toString());
    return { data };
}));
router.delete("/sessions/:sessionId", (0, middleware_1.authentication)(), (0, middleware_1.responceFormatter)(async (req) => {
    const data = await authentication_service_1.default.revokeSession(req.user._id.toString(), req.params.sessionId);
    return { data };
}));
router.post("/logout", (0, middleware_1.validation)(validators.logoutSchema), (0, middleware_1.authentication)(), (0, middleware_1.responceFormatter)(async (req, res, _next) => {
    await authentication_service_1.default.logout(req.payload, req.user, req.validate.body);
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
}));
exports.default = router;
