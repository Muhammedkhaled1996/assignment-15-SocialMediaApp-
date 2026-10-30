"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = exports.UserLoginTrailsKey = exports.UserEmailTrailsKey = exports.UserEmailKey = exports.UserKey = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_js_1 = require("../../../config.js");
const email_enum_js_1 = require("../../enum/email.enum.js");
const domain_exception_js_1 = require("../../exception/domain.exception.js");
const UserKey = ({ email, subject = email_enum_js_1.EmailSubjectEnum.CONFIRM_EMAIL, }) => {
    return `User::${email}::${subject}`;
};
exports.UserKey = UserKey;
const UserEmailKey = ({ email, subject = email_enum_js_1.EmailSubjectEnum.CONFIRM_EMAIL, }) => {
    return `${(0, exports.UserKey)({ email, subject })}::OTP`;
};
exports.UserEmailKey = UserEmailKey;
const UserEmailTrailsKey = ({ email, subject = email_enum_js_1.EmailSubjectEnum.CONFIRM_EMAIL, }) => {
    return `${(0, exports.UserEmailKey)({ email, subject })}::Trails`;
};
exports.UserEmailTrailsKey = UserEmailTrailsKey;
const UserLoginTrailsKey = ({ email, subject = email_enum_js_1.EmailSubjectEnum.CONFIRM_EMAIL, }) => {
    return `${(0, exports.UserKey)({
        email,
        subject: subject ?? email_enum_js_1.EmailSubjectEnum.CONFIRM_EMAIL,
    })}::Login::Trails`;
};
exports.UserLoginTrailsKey = UserLoginTrailsKey;
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: process.env.APP_EMAIL,
        pass: process.env.APP_PASSWORD,
    },
});
const sendEmail = async ({ to, cc, bcc, subject, text, html, attachments = [], }) => {
    try {
        if (!to?.length && !cc?.length && !bcc?.length) {
            throw new domain_exception_js_1.BadRequestException("Missing email recipients");
        }
        if (!text?.length && !html?.length && !attachments?.length) {
            throw new domain_exception_js_1.BadRequestException("Missing email content");
        }
        const info = await transporter.sendMail({
            from: `"${config_js_1.APPLICATIION_NAME}" <${config_js_1.APP_EMAIL}>`,
            to,
            cc,
            bcc,
            subject,
            text,
            html,
            attachments,
        });
        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer_1.default.getTestMessageUrl(info));
    }
    catch (err) {
        console.error("Error while sending mail:", err);
    }
};
exports.sendEmail = sendEmail;
