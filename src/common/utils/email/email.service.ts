import nodemailer from "nodemailer";
import { APP_EMAIL, APPLICATIION_NAME } from "../../../config.js";
import { EmailSubjectEnum } from "../../enum/email.enum.js";
import { BadRequestException } from "../../exception/domain.exception.js";

export const UserKey = ({
  email,
  subject = EmailSubjectEnum.CONFIRM_EMAIL,
}: {
  email: string;
  subject: EmailSubjectEnum | string;
}) => {
  return `User::${email}::${subject}`;
};
export const UserEmailKey = ({
  email,
  subject = EmailSubjectEnum.CONFIRM_EMAIL,
}: {
  email: string;
  subject: EmailSubjectEnum;
}) => {
  return `${UserKey({ email, subject })}::OTP`;
};

export const UserEmailTrailsKey = ({
  email,
  subject = EmailSubjectEnum.CONFIRM_EMAIL,
}: {
  email: string;
  subject: EmailSubjectEnum;
}) => {
  return `${UserEmailKey({ email, subject })}::Trails`;
};

export const UserLoginTrailsKey = ({
  email,
  subject = EmailSubjectEnum.CONFIRM_EMAIL,
}: {
  email: string;
  subject: EmailSubjectEnum | string | null | undefined;
}) => {
  return `${UserKey({
    email,
    subject: subject ?? EmailSubjectEnum.CONFIRM_EMAIL,
  })}::Login::Trails`;
};

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.APP_EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

export const sendEmail = async ({
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  attachments = [],
}: {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: any[];
}) => {
  try {
    if (!to?.length && !cc?.length && !bcc?.length) {
      throw new BadRequestException("Missing email recipients");
    }
    if (!text?.length && !html?.length && !attachments?.length) {
      throw new BadRequestException("Missing email content");
    }
    const info = await transporter.sendMail({
      from: `"${APPLICATIION_NAME}" <${APP_EMAIL}>`, // sender address
      to, // list of recipients
      cc,
      bcc,
      subject, // subject line
      text, // plain text body
      html, // HTML body
      attachments,
    });

    console.log("Message sent: %s", info.messageId);
    // Preview URL is only available when using an Ethereal test account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  } catch (err) {
    console.error("Error while sending mail:", err);
  }
};
