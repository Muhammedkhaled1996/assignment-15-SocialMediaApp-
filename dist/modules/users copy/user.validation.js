"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.search = exports.followUser = exports.update = exports.resetPassword = exports.resendOtp = exports.confirmEmail = exports.logoutSchema = exports.signup = exports.login = exports.loginSchema = void 0;
const zod_1 = require("zod");
const enum_1 = require("../../common/enum");
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
const signup = (lang) => {
    return zod_1.z.object({
        body: (0, exports.loginSchema)(lang)
            .safeExtend({
            userName: utils_1.generalValidationFields.userName(lang),
            confirmPassword: utils_1.generalValidationFields.confirmPassword(lang),
            phone: utils_1.generalValidationFields.phone(lang),
            gender: utils_1.generalValidationFields.gender(lang),
            role: zod_1.z.enum(enum_1.UserRole).optional(),
        })
            .superRefine((data, ctx) => {
            utils_1.generalValidationFields.matchFields({ original: "password", copy: "confirmPassword", data, ctx, lang });
            if (!data.userName.includes(" ")) {
                ctx.addIssue({
                    code: "custom",
                    path: ["userName"],
                    message: "userName must includes space between firstName and lastName",
                });
            }
        }),
    });
};
exports.signup = signup;
const logoutSchema = (lang) => {
    return zod_1.z.object({
        body: zod_1.z.strictObject({
            action: utils_1.generalValidationFields.action(lang),
        }),
    });
};
exports.logoutSchema = logoutSchema;
const confirmEmail = (lang) => {
    return zod_1.z.object({
        body: zod_1.z.strictObject({
            email: utils_1.generalValidationFields.email(lang),
            otp: utils_1.generalValidationFields.otp(lang),
        }),
    });
};
exports.confirmEmail = confirmEmail;
const resendOtp = (lang) => {
    return zod_1.z.object({
        body: zod_1.z.strictObject({
            email: utils_1.generalValidationFields.email(lang),
        }),
    });
};
exports.resendOtp = resendOtp;
const resetPassword = (lang) => {
    return zod_1.z.object({
        body: zod_1.z
            .strictObject({
            email: utils_1.generalValidationFields.email(lang),
            otp: utils_1.generalValidationFields.otp(lang),
            password: utils_1.generalValidationFields.password(lang),
            confirmPassword: utils_1.generalValidationFields.confirmPassword(lang),
        })
            .superRefine((data, ctx) => {
            utils_1.generalValidationFields.matchFields({ original: "password", copy: "confirmPassword", data, ctx, lang });
        }),
    });
};
exports.resetPassword = resetPassword;
const update = (lang) => {
    return zod_1.z.object({
        body: zod_1.z.strictObject({
            userName: utils_1.generalValidationFields.userName(lang).optional(),
            phone: utils_1.generalValidationFields.phone(lang).optional(),
            gender: utils_1.generalValidationFields.gender(lang).optional(),
        }),
    });
};
exports.update = update;
const followUser = (lang) => {
    return zod_1.z.object({
        params: zod_1.z.strictObject({
            id: utils_1.generalValidationFields.id(lang),
        }),
    });
};
exports.followUser = followUser;
const search = (lang) => {
    return zod_1.z.object({
        query: zod_1.z.strictObject({
            search: zod_1.z.string().min(2),
        }),
    });
};
exports.search = search;
