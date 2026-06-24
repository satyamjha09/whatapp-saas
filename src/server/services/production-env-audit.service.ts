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

  items.push({
    id: "security-headers-enabled",
    title: "Security headers enabled",
    severity: process.env.SECURITY_HEADERS_ENABLED !== "false" ? "PASS" : "FAIL",
    message: process.env.SECURITY_HEADERS_ENABLED !== "false" ? "Security headers are enabled" : "SECURITY_HEADERS_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "csp-report-only-first",
    title: "CSP mode configured",
    severity: ["report-only", "enforce", undefined].includes(
      process.env.SECURITY_CSP_MODE as "report-only" | "enforce" | undefined
    ) ? "PASS" : "FAIL",
    message: process.env.SECURITY_CSP_MODE === "enforce" ? "CSP is enforced" : "CSP is in report-only mode",
    required: true,
  });

  items.push({
    id: "csrf-origin-guard-enabled",
    title: "CSRF origin guard enabled",
    severity: process.env.CSRF_ORIGIN_GUARD_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.CSRF_ORIGIN_GUARD_ENABLED !== "false"
        ? "CSRF origin guard is enabled"
        : "CSRF_ORIGIN_GUARD_ENABLED must not be false in production",
    required: true,
  });

  const csrfTrustedOrigins = [
    ...(process.env.CSRF_TRUSTED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);

  items.push({
    id: "csrf-trusted-origins-configured",
    title: "CSRF trusted origins configured",
    severity: csrfTrustedOrigins.length > 0 ? "PASS" : "FAIL",
    message:
      csrfTrustedOrigins.length > 0
        ? "At least one trusted browser origin is configured"
        : "Set NEXT_PUBLIC_APP_URL or CSRF_TRUSTED_ORIGINS",
    required: true,
  });

  items.push({
    id: "csrf-missing-origin-blocked",
    title: "CSRF missing origin policy",
    severity:
      process.env.CSRF_ALLOW_MISSING_ORIGIN !== "true" || !isProduction()
        ? "PASS"
        : "FAIL",
    message:
      process.env.CSRF_ALLOW_MISSING_ORIGIN === "true" && isProduction()
        ? "CSRF_ALLOW_MISSING_ORIGIN must not be true in production"
        : "Missing Origin/Referer requests are blocked in production",
    required: true,
  });

  items.push({
    id: "request-body-guard-enabled",
    title: "Request body guard enabled",
    severity:
      process.env.REQUEST_BODY_GUARD_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.REQUEST_BODY_GUARD_ENABLED !== "false"
        ? "Oversized payload guard is enabled"
        : "REQUEST_BODY_GUARD_ENABLED must not be false in production",
    required: true,
  });

  const maxJsonBodyBytes = Number(process.env.MAX_JSON_BODY_BYTES ?? 1048576);
  const isJsonBodyLimitSafe =
    Number.isFinite(maxJsonBodyBytes) &&
    maxJsonBodyBytes > 0 &&
    maxJsonBodyBytes <= 5 * 1024 * 1024;

  items.push({
    id: "request-body-json-limit-safe",
    title: "JSON body size limit",
    severity: isJsonBodyLimitSafe ? "PASS" : "FAIL",
    message: isJsonBodyLimitSafe
      ? "JSON body size limit is within safe range"
      : "MAX_JSON_BODY_BYTES should be between 1 byte and 5 MB",
    required: true,
  });

  items.push({
    id: "webhook-signature-verification-enabled",
    title: "Webhook signature verification enabled",
    severity:
      process.env.WEBHOOK_SIGNATURE_VERIFICATION_ENABLED !== "false"
        ? "PASS"
        : "FAIL",
    message:
      process.env.WEBHOOK_SIGNATURE_VERIFICATION_ENABLED !== "false"
        ? "Webhook signature verification is enabled"
        : "WEBHOOK_SIGNATURE_VERIFICATION_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "meta-app-secret-configured",
    title: "Meta app secret configured",
    severity: exists(process.env.META_APP_SECRET) ? "PASS" : "FAIL",
    message: exists(process.env.META_APP_SECRET)
      ? "META_APP_SECRET is configured"
      : "META_APP_SECRET is required to verify WhatsApp webhook signatures",
    required: true,
  });

  items.push({
    id: "razorpay-webhook-secret-configured",
    title: "Razorpay webhook secret configured",
    severity: exists(process.env.RAZORPAY_WEBHOOK_SECRET) ? "PASS" : "FAIL",
    message: exists(process.env.RAZORPAY_WEBHOOK_SECRET)
      ? "RAZORPAY_WEBHOOK_SECRET is configured"
      : "RAZORPAY_WEBHOOK_SECRET is required to verify payment webhook signatures",
    required: true,
  });

  items.push({
    id: "webhook-replay-mode-safe",
    title: "Webhook replay guard mode",
    severity: ["log", "block", undefined].includes(
      process.env.WEBHOOK_REPLAY_GUARD_MODE as
        | "log"
        | "block"
        | undefined,
    )
      ? "PASS"
      : "FAIL",
    message:
      process.env.WEBHOOK_REPLAY_GUARD_MODE === "block"
        ? "Webhook replay guard is in blocking mode"
        : "Webhook replay guard is in logging mode",
    required: true,
  });

  items.push({
    id: "safe-log-redaction-enabled",
    title: "Safe log redaction enabled",
    severity:
      process.env.APP_LOG_REDACTION_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.APP_LOG_REDACTION_ENABLED !== "false"
        ? "Sensitive log redaction is enabled"
        : "APP_LOG_REDACTION_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "production-json-logs",
    title: "Production log format",
    severity:
      !isProduction() || process.env.APP_LOG_FORMAT === "json"
        ? "PASS"
        : "WARNING",
    message:
      !isProduction() || process.env.APP_LOG_FORMAT === "json"
        ? "Production logs are configured for structured JSON"
        : "Use APP_LOG_FORMAT=json in production for easier log aggregation",
    required: false,
  });

  items.push({
    id: "audit-log-hash-secret",
    title: "Audit log hash secret configured",
    severity:
      exists(process.env.AUDIT_LOG_HASH_SECRET) &&
      (process.env.AUDIT_LOG_HASH_SECRET?.length ?? 0) >= 32
        ? "PASS"
        : "FAIL",
    message:
      exists(process.env.AUDIT_LOG_HASH_SECRET) &&
      (process.env.AUDIT_LOG_HASH_SECRET?.length ?? 0) >= 32
        ? "AUDIT_LOG_HASH_SECRET is configured"
        : "AUDIT_LOG_HASH_SECRET must be at least 32 characters",
    required: true,
  });

  items.push({
    id: "tenant-guard-enabled",
    title: "Multi-tenant data isolation guard enabled",
    severity: process.env.TENANT_GUARD_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.TENANT_GUARD_ENABLED !== "false"
        ? "Tenant guard is enabled"
        : "TENANT_GUARD_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "secret-encryption-v2-enabled",
    title: "Secret encryption v2 enabled",
    severity:
      process.env.SECRET_ENCRYPTION_V2_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.SECRET_ENCRYPTION_V2_ENABLED !== "false"
        ? "Secret encryption v2 is enabled"
        : "SECRET_ENCRYPTION_V2_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "encryption-active-key-id",
    title: "Active encryption key ID configured",
    severity: exists(process.env.ENCRYPTION_ACTIVE_KEY_ID) ? "PASS" : "FAIL",
    message: exists(process.env.ENCRYPTION_ACTIVE_KEY_ID)
      ? "ENCRYPTION_ACTIVE_KEY_ID is configured"
      : "ENCRYPTION_ACTIVE_KEY_ID is required for key rotation",
    required: true,
  });

  items.push({
    id: "encryption-keyring-configured",
    title: "Encryption keyring configured",
    severity: exists(process.env.ENCRYPTION_KEYS_JSON) ? "PASS" : "FAIL",
    message: exists(process.env.ENCRYPTION_KEYS_JSON)
      ? "ENCRYPTION_KEYS_JSON is configured"
      : "ENCRYPTION_KEYS_JSON is required for versioned secret encryption",
    required: true,
  });

  items.push({
    id: "platform-admin-enabled",
    title: "Platform admin console enabled",
    severity:
      process.env.PLATFORM_ADMIN_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.PLATFORM_ADMIN_ENABLED !== "false"
        ? "Platform admin console is enabled"
        : "PLATFORM_ADMIN_ENABLED must not be false in production",
    required: true,
  });

  const platformAdminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  items.push({
    id: "platform-admin-emails-configured",
    title: "Platform admin emails configured",
    severity: platformAdminEmails.length > 0 ? "PASS" : "FAIL",
    message:
      platformAdminEmails.length > 0
        ? `${platformAdminEmails.length} platform admin email(s) configured`
        : "PLATFORM_ADMIN_EMAILS must include at least one admin email",
    required: true,
  });

  items.push({
    id: "dead-letter-queue-enabled",
    title: "Dead letter queue enabled",
    severity:
      process.env.DEAD_LETTER_QUEUE_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.DEAD_LETTER_QUEUE_ENABLED !== "false"
        ? "Dead letter queue monitoring is enabled"
        : "DEAD_LETTER_QUEUE_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "billing-reconciliation-enabled",
    title: "Billing reconciliation enabled",
    severity:
      process.env.BILLING_RECONCILIATION_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.BILLING_RECONCILIATION_ENABLED !== "false"
        ? "Billing reconciliation is enabled"
        : "BILLING_RECONCILIATION_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "public-api-v1-enabled",
    title: "Public API v1 enabled",
    severity: process.env.PUBLIC_API_V1_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.PUBLIC_API_V1_ENABLED !== "false"
        ? "Public API v1 is enabled"
        : "PUBLIC_API_V1_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "public-api-idempotency-enabled",
    title: "Public API idempotency enabled",
    severity:
      process.env.PUBLIC_API_IDEMPOTENCY_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.PUBLIC_API_IDEMPOTENCY_ENABLED !== "false"
        ? "Public API idempotency is enabled"
        : "PUBLIC_API_IDEMPOTENCY_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "public-api-idempotency-required",
    title: "Public API idempotency required for mutations",
    severity:
      process.env.PUBLIC_API_REQUIRE_IDEMPOTENCY_FOR_MUTATIONS !== "false"
        ? "PASS"
        : "FAIL",
    message:
      process.env.PUBLIC_API_REQUIRE_IDEMPOTENCY_FOR_MUTATIONS !== "false"
        ? "Mutating public API requests require Idempotency-Key"
        : "PUBLIC_API_REQUIRE_IDEMPOTENCY_FOR_MUTATIONS must not be false in production",
    required: true,
  });

  items.push({
    id: "privacy-center-enabled",
    title: "Privacy Center enabled",
    severity: process.env.PRIVACY_CENTER_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.PRIVACY_CENTER_ENABLED !== "false"
        ? "Privacy Center is enabled"
        : "PRIVACY_CENTER_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "privacy-export-dir-configured",
    title: "Privacy export directory configured",
    severity: exists(process.env.PRIVACY_EXPORT_DIR) ? "PASS" : "WARNING",
    message: exists(process.env.PRIVACY_EXPORT_DIR)
      ? "PRIVACY_EXPORT_DIR is configured"
      : "PRIVACY_EXPORT_DIR should be configured outside the public app directory",
    required: false,
  });

  items.push({
    id: "public-privacy-portal-enabled",
    title: "Public Privacy Portal enabled",
    severity:
      process.env.PUBLIC_PRIVACY_PORTAL_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.PUBLIC_PRIVACY_PORTAL_ENABLED !== "false"
        ? "Public Privacy Portal is enabled"
        : "PUBLIC_PRIVACY_PORTAL_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "public-privacy-token-secret",
    title: "Public privacy token secret configured",
    severity:
      exists(process.env.PUBLIC_PRIVACY_TOKEN_SECRET) &&
      process.env.PUBLIC_PRIVACY_TOKEN_SECRET!.length >= 32
        ? "PASS"
        : "FAIL",
    message:
      exists(process.env.PUBLIC_PRIVACY_TOKEN_SECRET) &&
      process.env.PUBLIC_PRIVACY_TOKEN_SECRET!.length >= 32
        ? "PUBLIC_PRIVACY_TOKEN_SECRET is configured"
        : "PUBLIC_PRIVACY_TOKEN_SECRET must be at least 32 characters",
    required: true,
  });

  items.push({
    id: "public-privacy-portal-url",
    title: "Public privacy portal URL configured",
    severity: exists(process.env.PUBLIC_PRIVACY_PORTAL_URL) ? "PASS" : "WARNING",
    message: exists(process.env.PUBLIC_PRIVACY_PORTAL_URL)
      ? "PUBLIC_PRIVACY_PORTAL_URL is configured"
      : "PUBLIC_PRIVACY_PORTAL_URL should be configured",
    required: false,
  });

  items.push({
    id: "data-retention-enabled",
    title: "Data retention enabled",
    severity: process.env.DATA_RETENTION_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.DATA_RETENTION_ENABLED !== "false"
        ? "Data retention is enabled"
        : "DATA_RETENTION_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "data-retention-dry-run-review",
    title: "Data retention dry-run reviewed",
    severity: process.env.DATA_RETENTION_DRY_RUN === "false" ? "PASS" : "WARNING",
    message:
      process.env.DATA_RETENTION_DRY_RUN === "false"
        ? "Data retention is allowed to delete records"
        : "DATA_RETENTION_DRY_RUN is enabled. Review preview counts before disabling.",
    required: false,
  });

  items.push({
    id: "consent-ledger-enabled",
    title: "Consent ledger enabled",
    severity: process.env.CONSENT_LEDGER_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.CONSENT_LEDGER_ENABLED !== "false"
        ? "Consent ledger is enabled"
        : "CONSENT_LEDGER_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "marketing-opt-in-required",
    title: "Marketing opt-in required",
    severity:
      process.env.CONSENT_REQUIRE_MARKETING_OPT_IN !== "false"
        ? "PASS"
        : "WARNING",
    message:
      process.env.CONSENT_REQUIRE_MARKETING_OPT_IN !== "false"
        ? "Marketing templates require explicit opt-in"
        : "Marketing opt-in guard is disabled",
    required: false,
  });

  items.push({
    id: "compliance-evidence-center-enabled",
    title: "Compliance Evidence Center enabled",
    severity:
      process.env.COMPLIANCE_EVIDENCE_CENTER_ENABLED !== "false"
        ? "PASS"
        : "FAIL",
    message:
      process.env.COMPLIANCE_EVIDENCE_CENTER_ENABLED !== "false"
        ? "Compliance Evidence Center is enabled"
        : "COMPLIANCE_EVIDENCE_CENTER_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "trust-center-required-documents",
    title: "Trust Center required documents configured",
    severity: exists(process.env.TRUST_CENTER_REQUIRED_DOCUMENT_TYPES)
      ? "PASS"
      : "WARNING",
    message: exists(process.env.TRUST_CENTER_REQUIRED_DOCUMENT_TYPES)
      ? "TRUST_CENTER_REQUIRED_DOCUMENT_TYPES is configured"
      : "Using default required documents: Terms, Privacy Policy, DPA",
    required: false,
  });

  items.push({
    id: "trust-center-public-api-acceptance",
    title: "Public API legal acceptance guard",
    severity:
      process.env.TRUST_CENTER_REQUIRE_ACCEPTANCE_FOR_PUBLIC_API !== "false"
        ? "PASS"
        : "WARNING",
    message:
      process.env.TRUST_CENTER_REQUIRE_ACCEPTANCE_FOR_PUBLIC_API !== "false"
        ? "Public API mutations require legal acceptance"
        : "Public API legal acceptance guard is disabled",
    required: false,
  });

  items.push({
    id: "compliance-evidence-export-dir-configured",
    title: "Compliance evidence export directory configured",
    severity: exists(process.env.COMPLIANCE_EVIDENCE_EXPORT_DIR)
      ? "PASS"
      : "WARNING",
    message: exists(process.env.COMPLIANCE_EVIDENCE_EXPORT_DIR)
      ? "COMPLIANCE_EVIDENCE_EXPORT_DIR is configured"
      : "COMPLIANCE_EVIDENCE_EXPORT_DIR should be configured outside the public app directory",
    required: false,
  });

  items.push({
    id: "campaign-analytics-v2-enabled",
    title: "Campaign Analytics v2 enabled",
    severity:
      process.env.CAMPAIGN_ANALYTICS_V2_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.CAMPAIGN_ANALYTICS_V2_ENABLED !== "false"
        ? "Campaign Analytics v2 is enabled"
        : "CAMPAIGN_ANALYTICS_V2_ENABLED must not be false in production",
    required: false,
  });

  items.push({
    id: "rbac-v2-enabled",
    title: "Enterprise RBAC enabled",
    severity: process.env.RBAC_V2_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.RBAC_V2_ENABLED !== "false"
        ? "Enterprise RBAC is enabled"
        : "RBAC_V2_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "rbac-v2-strict-mode",
    title: "Enterprise RBAC strict mode",
    severity: process.env.RBAC_V2_STRICT_MODE !== "false" ? "PASS" : "WARNING",
    message:
      process.env.RBAC_V2_STRICT_MODE !== "false"
        ? "RBAC strict mode is enabled"
        : "RBAC strict mode is disabled; users without roles may receive fallback permissions",
    required: false,
  });

  items.push({
    id: "rbac-permission-audit-enabled",
    title: "RBAC permission audit enabled",
    severity: process.env.RBAC_PERMISSION_AUDIT_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.RBAC_PERMISSION_AUDIT_ENABLED !== "false"
        ? "RBAC permission audit is enabled"
        : "RBAC_PERMISSION_AUDIT_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "rbac-permission-audit-fail-on-missing-guards",
    title: "RBAC audit fails on missing guards",
    severity:
      process.env.RBAC_PERMISSION_AUDIT_FAIL_ON_MISSING_GUARDS !== "false"
        ? "PASS"
        : "WARNING",
    message:
      process.env.RBAC_PERMISSION_AUDIT_FAIL_ON_MISSING_GUARDS !== "false"
        ? "RBAC audit fails when sensitive routes miss guards"
        : "Missing route guards only warn; production should fail",
    required: false,
  });

  items.push({
    id: "feature-entitlements-enabled",
    title: "Feature entitlements enabled",
    severity: process.env.FEATURE_ENTITLEMENTS_ENABLED !== "false" ? "PASS" : "FAIL",
    message: process.env.FEATURE_ENTITLEMENTS_ENABLED !== "false"
      ? "Feature entitlements are enabled"
      : "FEATURE_ENTITLEMENTS_ENABLED must not be false in production",
    required: true,
  });
  items.push({
    id: "feature-entitlements-strict-mode",
    title: "Feature entitlements strict mode",
    severity: process.env.FEATURE_ENTITLEMENTS_STRICT_MODE !== "false" ? "PASS" : "WARNING",
    message: process.env.FEATURE_ENTITLEMENTS_STRICT_MODE !== "false"
      ? "Feature entitlement strict mode is enabled"
      : "Unknown plan rows may allow features. Enable strict mode in production.",
    required: false,
  });
  items.push({
    id: "feature-entitlements-block-past-due",
    title: "Past-due subscription blocking",
    severity: process.env.FEATURE_ENTITLEMENTS_BLOCK_PAST_DUE !== "false" ? "PASS" : "WARNING",
    message: process.env.FEATURE_ENTITLEMENTS_BLOCK_PAST_DUE !== "false"
      ? "Past-due subscriptions are blocked from gated features"
      : "Past-due subscriptions are not blocked",
    required: false,
  });

  items.push({
    id: "usage-quotas-enabled",
    title: "Usage quotas enabled",
    severity: process.env.USAGE_QUOTAS_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.USAGE_QUOTAS_ENABLED !== "false"
        ? "Usage quotas are enabled"
        : "USAGE_QUOTAS_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "usage-quotas-strict-mode",
    title: "Usage quotas strict mode",
    severity:
      process.env.USAGE_QUOTAS_STRICT_MODE !== "false" ? "PASS" : "WARNING",
    message:
      process.env.USAGE_QUOTAS_STRICT_MODE !== "false"
        ? "Usage quota strict mode is enabled"
        : "Usage quota strict mode is disabled",
    required: false,
  });

  items.push({
    id: "usage-quota-alerts-enabled",
    title: "Usage quota alerts enabled",
    severity:
      process.env.USAGE_QUOTA_ALERTS_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.USAGE_QUOTA_ALERTS_ENABLED !== "false"
        ? "Usage quota alerts are enabled"
        : "USAGE_QUOTA_ALERTS_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "usage-quota-alert-thresholds",
    title: "Usage quota alert thresholds configured",
    severity: process.env.USAGE_QUOTA_ALERT_THRESHOLDS ? "PASS" : "WARNING",
    message: process.env.USAGE_QUOTA_ALERT_THRESHOLDS
      ? "USAGE_QUOTA_ALERT_THRESHOLDS is configured"
      : "Using default alert thresholds: 80,90,100",
    required: false,
  });

  items.push({
    id: "plan-upgrades-enabled",
    title: "Plan upgrades enabled",
    severity: process.env.PLAN_UPGRADES_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.PLAN_UPGRADES_ENABLED !== "false"
        ? "Plan upgrades are enabled"
        : "PLAN_UPGRADES_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "plan-upgrade-razorpay-configured",
    title: "Plan upgrade Razorpay credentials configured",
    severity:
      exists(process.env.RAZORPAY_KEY_ID) &&
      exists(process.env.RAZORPAY_KEY_SECRET)
        ? "PASS"
        : "FAIL",
    message:
      exists(process.env.RAZORPAY_KEY_ID) &&
      exists(process.env.RAZORPAY_KEY_SECRET)
        ? "Razorpay credentials are configured"
        : "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required",
    required: true,
  });

  items.push({
    id: "plan-upgrade-prices-configured",
    title: "Plan upgrade prices configured",
    severity:
      exists(process.env.PLAN_PRICE_STARTER_PAISE) &&
      exists(process.env.PLAN_PRICE_GROWTH_PAISE) &&
      exists(process.env.PLAN_PRICE_BUSINESS_PAISE)
        ? "PASS"
        : "WARNING",
    message:
      "Configure PLAN_PRICE_STARTER_PAISE, PLAN_PRICE_GROWTH_PAISE, and PLAN_PRICE_BUSINESS_PAISE before production.",
    required: false,
  });

  items.push({
    id: "billing-invoices-enabled",
    title: "Billing invoices enabled",
    severity:
      process.env.BILLING_INVOICES_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.BILLING_INVOICES_ENABLED !== "false"
        ? "Billing invoice ledger is enabled"
        : "BILLING_INVOICES_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "billing-invoice-seller-configured",
    title: "Billing seller details configured",
    severity:
      exists(process.env.BILLING_SELLER_NAME) &&
      exists(process.env.BILLING_SELLER_EMAIL)
        ? "PASS"
        : "WARNING",
    message:
      exists(process.env.BILLING_SELLER_NAME) &&
      exists(process.env.BILLING_SELLER_EMAIL)
        ? "Billing seller name/email are configured"
        : "Configure BILLING_SELLER_NAME and BILLING_SELLER_EMAIL before production",
    required: false,
  });

  items.push({
    id: "uptime-monitoring-enabled",
    title: "Uptime monitoring enabled",
    severity:
      process.env.UPTIME_MONITORING_ENABLED !== "false" ? "PASS" : "FAIL",
    message:
      process.env.UPTIME_MONITORING_ENABLED !== "false"
        ? "Uptime monitoring is enabled"
        : "UPTIME_MONITORING_ENABLED must not be false in production",
    required: true,
  });

  items.push({
    id: "uptime-monitor-public-url-configured",
    title: "Uptime monitor public URL configured",
    severity: exists(process.env.UPTIME_MONITOR_PUBLIC_URL) ? "PASS" : "WARNING",
    message: exists(process.env.UPTIME_MONITOR_PUBLIC_URL)
      ? "UPTIME_MONITOR_PUBLIC_URL is configured"
      : "UPTIME_MONITOR_PUBLIC_URL should be configured",
    required: false,
  });

  items.push({
    id: "uptime-monitor-health-url-configured",
    title: "Uptime monitor health URL configured",
    severity: exists(process.env.UPTIME_MONITOR_HEALTH_URL) ? "PASS" : "WARNING",
    message: exists(process.env.UPTIME_MONITOR_HEALTH_URL)
      ? "UPTIME_MONITOR_HEALTH_URL is configured"
      : "UPTIME_MONITOR_HEALTH_URL should be configured",
    required: false,
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
