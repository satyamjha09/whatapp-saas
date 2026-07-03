import nodemailer from "nodemailer";

export class TransactionalEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransactionalEmailError";
  }
}

function teamInviteEmailEnabled() {
  return process.env.TEAM_INVITE_EMAIL_ENABLED === "true";
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) {
    throw new TransactionalEmailError("SMTP configuration is missing.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

export type TransactionalEmailResult = {
  skipped: boolean;
  reason?: string;
  messageId?: string;
};

export async function sendTeamInviteTransactionalEmail({
  html,
  subject,
  text,
  to,
}: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<TransactionalEmailResult> {
  if (!teamInviteEmailEnabled()) {
    return {
      skipped: true,
      reason: "Email sending is disabled.",
    };
  }

  const from =
    process.env.SMTP_FROM ||
    `${process.env.TEAM_INVITE_FROM_NAME ?? "metawhat"} <${process.env.SMTP_USER}>`;
  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  return {
    skipped: false,
    messageId: info.messageId,
  };
}
