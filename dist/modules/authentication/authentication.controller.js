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
const utils_1 = require("../../common/utils");
const enum_1 = require("../../common/enum");
const service_1 = require("../../common/service");
const router = (0, express_1.Router)({ caseSensitive: true, strict: true });
router.post("/signup", (0, middleware_1.validation)(validators.signup), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.signup(req.validate.body, `${req.protocol}://${req.host}`);
    return { status: 201, data };
}));
router.patch("/confirm-email", (0, middleware_1.validation)(validators.confirmEmail), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.confirmEmail(req.validate.body);
}));
router.patch("/resend-otp", (0, middleware_1.validation)(validators.resendOtp), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.resendEmail(req.validate.body);
}));
const loginLimiter = utils_1.rateLimiterService.generateLimiter({ limit: 5, ttl: 5, skipSuccessfulRequests: true });
router.post("/login", loginLimiter, (0, middleware_1.validation)(validators.login), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.login(req.validate.body, `${req.protocol}://${req.host}`);
    if (req.rateLimit?.key)
        await service_1.cacheService.del({ key: req.rateLimit.key });
    return { data };
}));
router.post("/rotate-token", (0, middleware_1.authentication)(enum_1.TokenEnum.Refresh), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.rotateToken(req.payload, req.user);
    return { data };
}));
router.post("/sigup-with-gmail", (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const { status, data } = await authentication_service_1.default.siginUpWithGmail(req.body, `${req.protocol}://${req.host}`);
    return { data, status };
}));
router.post("/logout", (0, middleware_1.validation)(validators.logoutSchema), (0, middleware_1.authentication)(), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.logout(req.payload, req.user, req.validate.body);
}));
router.post("/requset-forgot-password-code", (0, middleware_1.validation)(validators.resendOtp), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.requestForgetPasswordCode(req.validate.body);
}));
router.patch("/verify-forgot-password", (0, middleware_1.validation)(validators.confirmEmail), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.verifyForgotPasswordCode(req.validate.body);
    return { data };
}));
router.patch("/reset-password", (0, middleware_1.validation)(validators.resetPassword), (0, middleware_1.responceFormatter)(async (req, res, next) => {
    const data = await authentication_service_1.default.resetPasswordCode(req.validate.body);
    return { data };
}));
exports.default = router;
