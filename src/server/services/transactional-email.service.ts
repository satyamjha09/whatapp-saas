import nodemailer from "nodemailer";

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;

  if (!host || !user || !password || !from) {
    throw new Error("SMTP is not configured");
  }

  return {
    host,
    port,
    user,
    password,
    from,
  };
}

export async function sendTransactionalEmail({
  from,
  replyTo,
  to,
  subject,
  text,
  html,
}: {
  from?: string;
  replyTo?: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const config = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  return transporter.sendMail({
    from: from ?? config.from,
    replyTo,
    to,
    subject,
    text,
    html,
  });
}

export async function verifyTransactionalEmailConnection() {
  const config = getSmtpConfig();

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  await transporter.verify();

  return {
    ok: true,
    host: config.host,
    port: config.port,
    from: config.from,
  };
}
