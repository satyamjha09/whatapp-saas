export async function getTransactionalEmailHealth() {
  const enabled = process.env.TEAM_INVITE_EMAIL_ENABLED === "true";
  const missing = [
    ["SMTP_HOST", process.env.SMTP_HOST],
    ["SMTP_PORT", process.env.SMTP_PORT],
    ["SMTP_USER", process.env.SMTP_USER],
    ["SMTP_PASSWORD", process.env.SMTP_PASSWORD],
    ["SMTP_FROM", process.env.SMTP_FROM],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return {
    enabled,
    missing,
    isHealthy: !enabled || missing.length === 0,
  };
}
