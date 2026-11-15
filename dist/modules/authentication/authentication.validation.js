"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokenSchema = exports.changePassword = exports.logoutSchema = exports.login = exports.loginSchema = void 0;
const zod_1 = require("zod");
const utils_1 = require("../../common/utils");
const loginSchema = (lang) => {
    return zod_1.z.strictObject({
        email: utils_1.generalValidationFields.email(lang),
        password: utils_1.generalValidationFields.password(lang),
    });
};
exports.loginSchema = loginSchema;
const login = (lang) => {
    return zod_1.z.object({
        body: (0, exports.loginSchema)(lang),
        query: zod_1.z.strictObject({
            lang: zod_1.z.enum(["ar", "en"]).default("ar"),
        }),
    });
};
exports.login = login;
const logoutSchema = (lang) => {
    return zod_1.z.object({
        body: zod_1.z.strictObject({
            action: utils_1.generalValidationFields.action(lang),
        }),
    });
};
exports.logoutSchema = logoutSchema;
const changePassword = (lang) => {
    return zod_1.z.object({
        body: zod_1.z
            .strictObject({
            currentPassword: zod_1.z.string().min(1),
            newPassword: utils_1.generalValidationFields.password(lang),
            confirmPassword: utils_1.generalValidationFields.confirmPassword(lang),
        })
            .superRefine((data, ctx) => {
            utils_1.generalValidationFields.matchFields({ original: "newPassword", copy: "confirmPassword", data, ctx, lang });
        }),
    });
};
exports.changePassword = changePassword;
const refreshTokenSchema = (_lang) => {
    return zod_1.z.object({
        body: zod_1.z
            .object({
            refreshToken: zod_1.z.string().optional(),
            refresh_token: zod_1.z.string().optional(),
        })
            .optional(),
    });
};
exports.refreshTokenSchema = refreshTokenSchema;
