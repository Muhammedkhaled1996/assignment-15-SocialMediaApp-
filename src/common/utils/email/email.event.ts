import { EventEmitter } from "node:events";
import { sendEmail } from "./email.service";
import { verifyEmailTemplate } from "./email.templates";
import { EmailSubjectEnum } from "../../enum/email.enum";

export const emailEvent = new EventEmitter();

emailEvent.on(
  "sendEmail",
  async ({
    subject = EmailSubjectEnum.CONFIRM_EMAIL,
    recipients,
    data,
  }: {
    subject?: EmailSubjectEnum;
    recipients: { to?: string[]; cc?: string[]; bcc?: string[] };
    data: any;
  }) => {
    try {
      await sendEmail({
        ...recipients,
        subject,
        html: verifyEmailTemplate({ subject, data  }),
      });
    } catch (error) {
      console.log(error);
    }
  },
);
