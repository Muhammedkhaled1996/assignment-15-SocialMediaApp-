"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailEvent = void 0;
const node_events_1 = require("node:events");
const email_service_1 = require("./email.service");
const email_templates_1 = require("./email.templates");
const email_enum_1 = require("../../enum/email.enum");
exports.emailEvent = new node_events_1.EventEmitter();
exports.emailEvent.on("sendEmail", async ({ subject = email_enum_1.EmailSubjectEnum.CONFIRM_EMAIL, recipients, data, }) => {
    try {
        await (0, email_service_1.sendEmail)({
            ...recipients,
            subject,
            html: (0, email_templates_1.verifyEmailTemplate)({ subject, data }),
        });
    }
    catch (error) {
        console.log(error);
    }
});
