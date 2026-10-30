"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generalValidationFields = void 0;
const zod_1 = require("zod");
const mongoose_1 = __importDefault(require("mongoose"));
const enum_1 = require("../enum");
const matchFields = ({ original, copy, data, ctx, lang, }) => {
    if (data[original] != data[copy]) {
        ctx.addIssue({
            code: "custom",
            path: [copy],
            message: `${lang == enum_1.LanguageEnum.AR
                ? `لا يوجد تطابق بين ${original} و ${copy}`
                : `Failed to match between ${original} and ${copy}`}`,
        });
    }
};
exports.generalValidationFields = {
    email: (lang) => zod_1.z.email({
        message: lang == enum_1.LanguageEnum.AR
            ? "الايميل الذى قمت بإدخالة غير صحيح من فضلة ضم بإدخال إيميل صحيح"
            : "Invalid email format please add valid email like example@any.com",
    }),
    password: (lang) => zod_1.z.string().regex(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/, {
        message: lang == enum_1.LanguageEnum.AR
            ? "يجب ألا تقل كلمة المرور عن 8 خانات، وتتضمن حرفاً كبيراً، وحرفاً صغيراً، ورقماً واحداً على الأقل"
            : "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, and one number",
    }),
    userName: (lang) => zod_1.z.string().min(2, {
        message: lang == enum_1.LanguageEnum.AR ? "عفوا لا يمكن ادخال اسم المستخدم اقل من حرفين" : "min length is 2 chars",
    }),
    confirmPassword: (lang) => zod_1.z
        .string()
        .min(6, { message: lang == enum_1.LanguageEnum.AR ? "اقل طول للباسورد 6 احرف" : "invalid password length < 6 chars" })
        .max(16, {
        message: lang == enum_1.LanguageEnum.AR ? "اكبر طول للباسورد 16 حرف" : "invalid password length > 16 chars",
    }),
    phone: (lang) => zod_1.z
        .string()
        .regex(/^(\+201|01|00201)[0-2,5]{1}[0-9]{8}/, lang == enum_1.LanguageEnum.AR ? "يجب إدخال رقم مصرى فقط" : "Invalid egyption phone number"),
    otp: (lang) => zod_1.z
        .string()
        .regex(/^\d{6}$/, lang == enum_1.LanguageEnum.AR ? "يجب أدخال عدد 6 أرقام فقط" : "OTP should contain 6 numbers only"),
    gender: (lang) => zod_1.z.enum(enum_1.GenderEnum, {
        message: lang == enum_1.LanguageEnum.AR ? "المسموح بدخالة 0 للذكر و 1 للانثى" : "only valid 0 for male and 1 for female",
    }),
    action: (lang) => zod_1.z.enum(enum_1.LogoutEnum, {
        message: lang == enum_1.LanguageEnum.AR
            ? "يجب تحديد نوع تسجيل الخروج اما 0 لجهاز واحد او 1 كل الاجهزة"
            : "you should select type of logout between 0 for one device or 1 for all devices",
    }),
    matchFields,
    id: (lang) => zod_1.z.string().refine((data) => {
        return mongoose_1.default.Types.ObjectId.isValid(data);
    }, { message: lang == enum_1.LanguageEnum.AR ? "صيغة خطا" : "Invalid format" }),
    file: (lang) => zod_1.z.strictObject({
        fieldname: zod_1.z.string(),
        originalname: zod_1.z.string(),
        encoding: zod_1.z.string(),
        mimetype: zod_1.z.string(),
        buffer: zod_1.z.instanceof(Buffer),
        size: zod_1.z.number(),
        path: zod_1.z.string(),
    }),
};
