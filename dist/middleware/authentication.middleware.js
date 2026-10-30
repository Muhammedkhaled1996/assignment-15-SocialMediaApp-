"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorization = exports.authentication = exports.bearerAuth = void 0;
const TokenEnum_js_1 = require("../common/enum/TokenEnum.js");
const token_security_js_1 = require("../common/security/token.security.js");
const domain_exception_js_1 = require("../common/exception/domain.exception.js");
const tokenSecurityService = new token_security_js_1.TokenSecurityService();
const bearerAuth = async ({ req, tokenType = TokenEnum_js_1.TokenEnum.Access }) => {
    const { authorization } = req.headers;
    const { user, payload } = await tokenSecurityService.decodeToken({ authorization, tokenType });
    req.user = user;
    req.payload = payload;
};
exports.bearerAuth = bearerAuth;
const authentication = (tokenType = TokenEnum_js_1.TokenEnum.Access) => {
    return async (req, res, next) => {
        const { authorization } = req.headers;
        await (0, exports.bearerAuth)({ req, tokenType });
        next();
    };
};
exports.authentication = authentication;
const authorization = (userRole) => {
    return async (req, res, next) => {
        const user = req.user;
        const userPrivileges = user?.role;
        const hasPermission = userPrivileges !== undefined && userPrivileges >= userRole;
        if (!hasPermission) {
            throw new domain_exception_js_1.ForbiddenException("Forbidden: Access Denied");
        }
        next();
    };
};
exports.authorization = authorization;
