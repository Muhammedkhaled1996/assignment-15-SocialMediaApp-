"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeRoles = exports.authenticate = exports.authentication = exports.bearerAuth = void 0;
exports.resolveBranchContext = resolveBranchContext;
exports.resolveScopedBranchFilter = resolveScopedBranchFilter;
exports.assertBranchAccess = assertBranchAccess;
const node_crypto_1 = require("node:crypto");
const mongoose_1 = __importDefault(require("mongoose"));
const TokenEnum_js_1 = require("../common/enum/TokenEnum.js");
const userRole_enum_js_1 = require("../common/enum/userRole.enum.js");
const domain_exception_js_1 = require("../common/exception/domain.exception.js");
const token_service_js_1 = require("../common/service/token.service.js");
function extractCookieToken(cookieHeader, cookieName) {
    if (!cookieHeader)
        return undefined;
    const parts = cookieHeader.split(";");
    for (const part of parts) {
        const [k, ...v] = part.trim().split("=");
        if (k === cookieName) {
            return decodeURIComponent(v.join("="));
        }
    }
    return undefined;
}
function resolveBranchContext(user, requestedBranchId) {
    const roleNumber = user.roleNumber || userRole_enum_js_1.UserRole.EMPLOYEE;
    const isCompanyWideRole = userRole_enum_js_1.COMPANY_WIDE_ROLES.includes(roleNumber) || Boolean(user.canAccessAllBranches);
    const allowedBranchesSet = new Set();
    if (user.branchId) {
        allowedBranchesSet.add(user.branchId.toString());
    }
    if (user.primaryBranchId) {
        allowedBranchesSet.add(user.primaryBranchId.toString());
    }
    if (Array.isArray(user.assignedBranchIds)) {
        for (const b of user.assignedBranchIds) {
            if (b)
                allowedBranchesSet.add(b.toString());
        }
    }
    const allowedBranchIds = Array.from(allowedBranchesSet);
    let activeBranchId = user.branchId?.toString() || user.primaryBranchId?.toString() || allowedBranchIds[0];
    if (requestedBranchId && mongoose_1.default.Types.ObjectId.isValid(requestedBranchId)) {
        if (isCompanyWideRole || allowedBranchesSet.has(requestedBranchId)) {
            activeBranchId = requestedBranchId;
        }
    }
    return {
        isCentralAdmin: isCompanyWideRole,
        allowedBranchIds,
        activeBranchId,
        companyId: user.companyId?.toString(),
    };
}
const bearerAuth = async ({ req, tokenType = TokenEnum_js_1.TokenEnum.Access }) => {
    let authorization = req.headers.authorization;
    if (!authorization && req.headers.cookie) {
        const cookieToken = tokenType === TokenEnum_js_1.TokenEnum.Refresh
            ? extractCookieToken(req.headers.cookie, "refresh_token")
            : extractCookieToken(req.headers.cookie, "access_token");
        if (cookieToken) {
            authorization = `Bearer ${cookieToken}`;
        }
    }
    const { user, payload } = await token_service_js_1.tokenSecurityService.decodeToken({ authorization, tokenType });
    req.user = user;
    req.payload = payload;
    if (!req.requestId) {
        req.requestId = req.headers["x-request-id"] || (0, node_crypto_1.randomUUID)();
    }
    const headerBranchId = req.headers["x-branch-id"] || undefined;
    req.branchContext = resolveBranchContext(user, headerBranchId);
};
exports.bearerAuth = bearerAuth;
const authentication = (tokenType = TokenEnum_js_1.TokenEnum.Access) => {
    return async (req, _res, next) => {
        await (0, exports.bearerAuth)({ req, tokenType });
        next();
    };
};
exports.authentication = authentication;
exports.authenticate = (0, exports.authentication)();
const authorizeRoles = (...allowedRoles) => {
    const allowedSet = new Set(allowedRoles);
    return async (req, _res, next) => {
        if (!req.user) {
            throw new domain_exception_js_1.UnauthorizedException("Authentication required");
        }
        if (req.user.isActive === false || (req.user.accountStatus && req.user.accountStatus !== "ACTIVE")) {
            throw new domain_exception_js_1.ForbiddenException("Account is deactivated");
        }
        const userRole = req.user.roleNumber;
        if (!userRole || !allowedSet.has(userRole)) {
            const allowedNames = allowedRoles.map((r) => `${userRole_enum_js_1.USER_ROLE_LABELS[r]}(${r})`).join(", ");
            throw new domain_exception_js_1.ForbiddenException(`Access denied. Required role: [${allowedNames}]`);
        }
        next();
    };
};
exports.authorizeRoles = authorizeRoles;
function resolveScopedBranchFilter(branchContext, requestedBranchId, fieldName = "branchId") {
    if (!branchContext) {
        throw new domain_exception_js_1.ForbiddenException("Branch context is not initialized");
    }
    const reqBranchStr = requestedBranchId ? requestedBranchId.toString() : undefined;
    if (branchContext.isCentralAdmin) {
        if (reqBranchStr && mongoose_1.default.Types.ObjectId.isValid(reqBranchStr)) {
            return { [fieldName]: new mongoose_1.default.Types.ObjectId(reqBranchStr) };
        }
        return {};
    }
    if (branchContext.allowedBranchIds.length === 0) {
        throw new domain_exception_js_1.ForbiddenException("User is not assigned to any active branch");
    }
    if (reqBranchStr) {
        if (!branchContext.allowedBranchIds.includes(reqBranchStr)) {
            throw new domain_exception_js_1.ForbiddenException("Cross-branch access denied: You do not have access to the requested branch");
        }
        return { [fieldName]: new mongoose_1.default.Types.ObjectId(reqBranchStr) };
    }
    return {
        [fieldName]: {
            $in: branchContext.allowedBranchIds.map((id) => new mongoose_1.default.Types.ObjectId(id)),
        },
    };
}
function assertBranchAccess(branchContext, targetBranchId) {
    if (!branchContext) {
        throw new domain_exception_js_1.ForbiddenException("Branch context is missing");
    }
    const resolvedId = targetBranchId?.toString() || branchContext.activeBranchId;
    if (!resolvedId || !mongoose_1.default.Types.ObjectId.isValid(resolvedId)) {
        throw new domain_exception_js_1.ForbiddenException("A valid branch is required for this operation");
    }
    if (!branchContext.isCentralAdmin && !branchContext.allowedBranchIds.includes(resolvedId)) {
        throw new domain_exception_js_1.ForbiddenException("Cross-branch access denied: Unauthorized branch");
    }
    return new mongoose_1.default.Types.ObjectId(resolvedId);
}
