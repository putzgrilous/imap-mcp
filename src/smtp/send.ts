import nodemailer from "nodemailer";
import type { AccountConfig, ResolvedCredentials } from "../config/schema.js";
import { getLogger } from "../logging/logger.js";

const log = getLogger("smtp");

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    contentBase64: string;
    contentType?: string;
    cid?: string;
  }>;
}

export async function sendEmail(
  account: AccountConfig,
  credentials: ResolvedCredentials,
  params: SendEmailParams,
): Promise<string> {
  if (!params.text && !params.html) {
    throw new Error("Either text or html body is required.");
  }

  const smtpHost = account.smtpHost ?? account.host.replace(/^imap\./, "smtp.");
  const smtpPort = account.smtpPort ?? (account.secure ? 465 : 587);

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: account.email,
      pass: credentials.value,
    },
  });

  const info = await transporter.sendMail({
    from: `${account.name} <${account.email}>`,
    to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    cc: params.cc ? (Array.isArray(params.cc) ? params.cc.join(", ") : params.cc) : undefined,
    bcc: params.bcc ? (Array.isArray(params.bcc) ? params.bcc.join(", ") : params.bcc) : undefined,
    replyTo: params.replyTo,
    inReplyTo: params.inReplyTo,
    references: params.references ? params.references.join(" ") : params.inReplyTo,
    attachments: params.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.contentBase64, "base64"),
      contentType: attachment.contentType,
      cid: attachment.cid,
    })),
  });

  log.info({ from: account.email, to: params.to, subject: params.subject, messageId: info.messageId }, "Email sent");
  return info.messageId;
}
