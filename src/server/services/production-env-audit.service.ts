type EnvAuditSeverity = "PASS" | "WARNING" | "FAIL";

type EnvAuditItem = {
  id: string;
  title: string;
  severity: EnvAuditSeverity;
  message: string;
  required: boolean;
};

function exists(value: string | undefined | null) {
  return Boolean(value && value.trim().length > 0);
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function hasDummyValue(value: string | undefined | null) {
  if (!value) return false;

  const normalized = value.toLowerCase();

  return [
    "dummy",
    "test",
    "changeme",
    "change_this",
    "local_",
    "example",
    "placeholder",
  ].some((keyword) => normalized.includes(keyword));
}

function checkRequiredEnv(name: string): EnvAuditItem {
  const value = process.env[name];

  return {
    id: `env-${name}`,
    title: name,
    severity: exists(value) ? "PASS" : "FAIL",
    message: exists(value) ? "Configured" : `${name} is missing`,
    required: true,
  };
}

export function getProductionEnvAudit() {
  const items: EnvAuditItem[] = [];

  const requiredEnvNames = [
    "DATABASE_URL",
    "REDIS_URL",
    "NEXT_PUBLIC_APP_URL",
    "ENCRYPTION_KEY",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    "HEALTHCHECK_TOKEN",
  ];

  for (const envName of requiredEnvNames) {
    items.push(checkRequiredEnv(envName));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  items.push({
    id: "public-app-url-https",
    title: "Public HTTPS app URL",
    severity:
      !exists(appUrl) || appUrl.startsWith("https://") || !isProduction()
        ? "PASS"
        : "FAIL",
    message:
      appUrl.startsWith("https://") || !isProduction()
        ? "App URL is acceptable"
        : "NEXT_PUBLIC_APP_URL must use HTTPS in production",
    required: true,
  });

  const encryptionKey = process.env.ENCRYPTION_KEY ?? "";

  items.push({
    id: "encryption-key-length",
    title: "Encryption key length",
    severity: encryptionKey.length === 32 ? "PASS" : "FAIL",
    message:
      encryptionKey.length === 32
        ? "ENCRYPTION_KEY is 32 characters"
        : "ENCRYPTION_KEY must be exactly 32 characters for AES-256 encryption",
    required: true,
  });

  const healthcheckToken = process.env.HEALTHCHECK_TOKEN ?? "";

  items.push({
    id: "healthcheck-token-strength",
    title: "Healthcheck token strength",
    severity:
      !exists(healthcheckToken) || healthcheckToken.length >= 32
        ? "PASS"
        : "FAIL",
    message:
      !exists(healthcheckToken) || healthcheckToken.length >= 32
        ? "HEALTHCHECK_TOKEN length is acceptable"
        : "HEALTHCHECK_TOKEN should be at least 32 characters",
    required: true,
  });

  const unsafePublicEnvNames = Object.keys(process.env).filter((key) => {
    const upper = key.toUpperCase();

    return (
      key.startsWith("NEXT_PUBLIC_") &&
      (upper.includes("SECRET") ||
        upper.includes("TOKEN") ||
        upper.includes("PASSWORD") ||
        upper.includes("PRIVATE"))
    );
  });

  items.push({
    id: "no-public-secrets",
    title: "No public secret leakage",
    severity: unsafePublicEnvNames.length === 0 ? "PASS" : "FAIL",
    message:
      unsafePublicEnvNames.length === 0
        ? "No suspicious NEXT_PUBLIC secret variables found"
        : `Suspicious public secret env vars: ${unsafePublicEnvNames.join(", ")}`,
    required: true,
  });

  const dummyEnvNames = Object.keys(process.env).filter((key) => {
    if (!isProduction()) return false;

    const upper = key.toUpperCase();

    if (
      !(
        upper.includes("KEY") ||
        upper.includes("SECRET") ||
        upper.includes("TOKEN") ||
        upper.includes("PASSWORD")
      )
    ) {
      return false;
    }

    return hasDummyValue(process.env[key]);
  });

  items.push({
    id: "no-dummy-production-secrets",
    title: "No dummy production secrets",
    severity: dummyEnvNames.length === 0 ? "PASS" : "FAIL",
    message:
      dummyEnvNames.length === 0
        ? "No dummy-looking production secrets detected"
        : `Dummy-looking secret values found: ${dummyEnvNames.join(", ")}`,
    required: true,
  });

  const razorpayValues = [
    process.env.RAZORPAY_KEY_ID,
    process.env.RAZORPAY_KEY_SECRET,
    process.env.RAZORPAY_WEBHOOK_SECRET,
  ];

  const razorpayConfiguredCount = razorpayValues.filter(exists).length;

  items.push({
    id: "razorpay-complete-config",
    title: "Razorpay config completeness",
    severity:
      razorpayConfiguredCount === 0 || razorpayConfiguredCount === 3
        ? "PASS"
        : "FAIL",
    message:
      razorpayConfiguredCount === 0
        ? "Razorpay is not configured"
        : razorpayConfiguredCount === 3
          ? "Razorpay checkout and webhook secrets are configured"
          : "Razorpay is partially configured. Set key ID, key secret, and webhook secret together.",
    required: true,
  });

  const emailEnabled = process.env.NOTIFICATION_EMAILS_ENABLED === "true";
  const emailRequired = [
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
  ];

  const missingEmailEnv = emailEnabled
    ? emailRequired.filter((name) => !exists(process.env[name]))
    : [];

  items.push({
    id: "smtp-complete-config",
    title: "SMTP config completeness",
    severity: missingEmailEnv.length === 0 ? "PASS" : "FAIL",
    message:
      !emailEnabled
        ? "Notification emails are disabled"
        : missingEmailEnv.length === 0
          ? "SMTP config is complete"
          : `SMTP is enabled but missing: ${missingEmailEnv.join(", ")}`,
    required: emailEnabled,
  });

  const backupsEnabled = process.env.DATABASE_BACKUPS_ENABLED === "true";

  items.push({
    id: "backup-config",
    title: "Database backup config",
    severity:
      !backupsEnabled ||
      (exists(process.env.DATABASE_BACKUP_DIR) &&
        exists(process.env.PG_DUMP_PATH))
        ? "PASS"
        : "FAIL",
    message: !backupsEnabled
      ? "Database backups are disabled"
      : "Database backup path and pg_dump path are configured",
    required: backupsEnabled,
  });

  const remoteBackupEnabled =
    process.env.DATABASE_BACKUP_REMOTE_STORAGE_ENABLED === "true";

  const missingRemoteBackupEnv = remoteBackupEnabled
    ? [
        "S3_BACKUP_BUCKET",
        "S3_BACKUP_ACCESS_KEY_ID",
        "S3_BACKUP_SECRET_ACCESS_KEY",
      ].filter((name) => !exists(process.env[name]))
    : [];

  items.push({
    id: "remote-backup-config",
    title: "Remote backup storage config",
    severity: missingRemoteBackupEnv.length === 0 ? "PASS" : "FAIL",
    message:
      !remoteBackupEnabled
        ? "Remote backup storage is disabled"
        : missingRemoteBackupEnv.length === 0
          ? "Remote backup storage config is complete"
          : `Remote backup storage is missing: ${missingRemoteBackupEnv.join(", ")}`,
    required: remoteBackupEnabled,
  });

  const failedItems = items.filter((item) => item.severity === "FAIL");
  const warningItems = items.filter((item) => item.severity === "WARNING");

  return {
    isProduction: isProduction(),
    isHealthy: failedItems.length === 0,
    failedCount: failedItems.length,
    warningCount: warningItems.length,
    passedCount: items.filter((item) => item.severity === "PASS").length,
    totalCount: items.length,
    items,
  };
}
