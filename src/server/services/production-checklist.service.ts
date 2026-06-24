import {
  type ProductionChecklistGroup,
  type ProductionChecklistItem,
} from "@/lib/production-checklist";
import { prisma } from "@/lib/prisma";
import { isRazorpayWebhookConfigured } from "@/server/services/razorpay-credit.service";
import { isRazorpayCheckoutConfigured } from "@/server/services/razorpay-subscription.service";
import type { UpdateProductionChecklistSettingsInput } from "@/server/validators/production-checklist.validator";

function buildItem(input: ProductionChecklistItem): ProductionChecklistItem {
  return input;
}

export async function getProductionChecklistByCompany(companyId: string) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const hasWebhookVerifyToken = Boolean(
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  );

  const [
    companySettings,
    whatsappAccount,
    inboundMessageCount,
    successfulOutboundMessageCount,
    approvedTemplateCount,
    memberCount,
    quickReplyCount,
    tagCount,
  ] = await prisma.$transaction([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        metaPaymentMethodAdded: true,
        metaBusinessVerificationStatus: true,
        productionChecklistNotes: true,
        productionChecklistUpdatedAt: true,
        billingPlan: true,
        subscriptionStatus: true,
        monthlyMessageLimit: true,
      },
    }),
    prisma.whatsAppAccount.findFirst({
      where: { companyId },
      include: {
        phoneNumbers: {
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "INBOUND",
        status: "RECEIVED",
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "OUTBOUND",
        metaMessageId: { not: null },
        status: { in: ["SENT", "DELIVERED", "READ"] },
      },
    }),
    prisma.template.count({
      where: { companyId, status: "APPROVED" },
    }),
    prisma.companyUser.count({ where: { companyId } }),
    prisma.quickReply.count({ where: { companyId } }),
    prisma.inboxTag.count({ where: { companyId } }),
  ]);

  const phoneNumber = whatsappAccount?.phoneNumbers[0];
  const hasWhatsAppCredentials =
    Boolean(whatsappAccount?.wabaId) &&
    Boolean(whatsappAccount?.accessToken) &&
    whatsappAccount?.status === "CONNECTED";
  const hasPhoneNumber =
    Boolean(phoneNumber?.phoneNumberId) &&
    Boolean(phoneNumber?.displayPhoneNumber);
  const hasPublicAppUrl =
    appUrl.startsWith("https://") &&
    !appUrl.includes("localhost") &&
    !appUrl.includes("127.0.0.1");
  const hasWebhookConfig = hasPublicAppUrl && hasWebhookVerifyToken;

  const groups: ProductionChecklistGroup[] = [
    {
      title: "WhatsApp Cloud API",
      description: "Core Meta setup required to send and receive messages.",
      items: [
        buildItem({
          id: "whatsapp-credentials",
          title: "WhatsApp credentials connected",
          description: hasWhatsAppCredentials
            ? "WABA ID and encrypted access token are saved."
            : "Save the WABA ID and access token in WhatsApp Settings.",
          status: hasWhatsAppCredentials ? "complete" : "pending",
          required: true,
          actionLabel: "WhatsApp Settings",
          actionHref: "/dashboard/whatsapp",
        }),
        buildItem({
          id: "phone-number",
          title: "Phone number connected",
          description: hasPhoneNumber
            ? `Connected number: ${phoneNumber?.displayPhoneNumber}`
            : "Save the Meta Phone Number ID and display number.",
          status: hasPhoneNumber ? "complete" : "pending",
          required: true,
          actionLabel: "WhatsApp Settings",
          actionHref: "/dashboard/whatsapp",
        }),
        buildItem({
          id: "webhook-config",
          title: "Webhook environment configured",
          description: hasWebhookConfig
            ? `Callback ready at ${appUrl}/api/webhooks/whatsapp`
            : hasWebhookVerifyToken && !hasPublicAppUrl
              ? "The verify token exists, but the app URL is not public HTTPS."
              : "Set a public app URL and WhatsApp webhook verify token.",
          status: hasWebhookConfig
            ? "complete"
            : hasWebhookVerifyToken
              ? "warning"
              : "pending",
          required: true,
          actionLabel: "WhatsApp Settings",
          actionHref: "/dashboard/whatsapp",
        }),
        buildItem({
          id: "inbound-test",
          title: "Inbound message test passed",
          description:
            inboundMessageCount > 0
              ? `${inboundMessageCount} inbound message(s) received.`
              : "Send a WhatsApp message to your business number.",
          status: inboundMessageCount > 0 ? "complete" : "pending",
          required: true,
          actionLabel: "Open Inbox",
          actionHref: "/dashboard/inbox",
        }),
        buildItem({
          id: "outbound-test",
          title: "Outbound reply test passed",
          description:
            successfulOutboundMessageCount > 0
              ? `${successfulOutboundMessageCount} outbound message(s) sent through Meta.`
              : "Reply from the inbox to confirm the full send pipeline.",
          status: successfulOutboundMessageCount > 0 ? "complete" : "pending",
          required: true,
          actionLabel: "Open Inbox",
          actionHref: "/dashboard/inbox",
        }),
      ],
    },
    {
      title: "Messaging readiness",
      description: "Templates and inbox tools for reliable customer support.",
      items: [
        buildItem({
          id: "approved-template",
          title: "Approved message template",
          description:
            approvedTemplateCount > 0
              ? `${approvedTemplateCount} approved template(s) available.`
              : "Create and approve at least one WhatsApp template.",
          status: approvedTemplateCount > 0 ? "complete" : "pending",
          required: true,
          actionLabel: "Open Templates",
          actionHref: "/dashboard/templates",
        }),
        buildItem({
          id: "team-setup",
          title: "Team members added",
          description:
            memberCount > 1
              ? `${memberCount} team members are in this workspace.`
              : "Invite at least one teammate before production.",
          status: memberCount > 1 ? "complete" : "warning",
          required: false,
          actionLabel: "Open Team",
          actionHref: "/dashboard/settings/team",
        }),
        buildItem({
          id: "team-plan-limits",
          title: "Team member plan limits enabled",
          description:
            "Workspace invitations and acceptance are protected by subscription seat limits.",
          status: "complete",
          required: true,
          actionLabel: "Open Team",
          actionHref: "/dashboard/settings/team",
        }),
        buildItem({
          id: "inbox-tools",
          title: "Inbox tools configured",
          description:
            quickReplyCount > 0 || tagCount > 0
              ? `${quickReplyCount} quick replies and ${tagCount} tags configured.`
              : "Add quick replies and tags for faster support.",
          status: quickReplyCount > 0 || tagCount > 0 ? "complete" : "warning",
          required: false,
          actionLabel: "Configure Tools",
          actionHref: "/dashboard/inbox/quick-replies",
        }),
      ],
    },
    {
      title: "Production business setup",
      description: "Operational items to confirm before serving customers.",
      items: [
        buildItem({
          id: "billing",
          title: "Billing plan initialized",
          description:
            companySettings?.billingPlan &&
            companySettings.monthlyMessageLimit > 0
              ? `Plan: ${companySettings.billingPlan}, status: ${companySettings.subscriptionStatus}.`
              : "The billing plan has not been initialized.",
          status:
            companySettings?.billingPlan &&
            companySettings.monthlyMessageLimit > 0
              ? "complete"
              : "pending",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "razorpay-webhook",
          title: "Razorpay webhook backup enabled",
          description: isRazorpayWebhookConfigured()
            ? "Signed Razorpay events are processed idempotently for credit purchases and subscription upgrades."
            : "Configure the Razorpay webhook secret before accepting payments.",
          status: isRazorpayWebhookConfigured() ? "complete" : "pending",
          required: true,
          actionLabel: "Open Credit Center",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "subscription-plan-limits",
          title: "Subscription plan limits enabled",
          description:
            "Monthly message quota and bulk recipient limits follow the workspace plan.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "plan-feature-gates",
          title: "Plan-based feature gates enabled",
          description:
            "Bulk campaigns, contact groups, developer API, and webhooks follow subscription access.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "developer-api-plan-rate-limits",
          title: "Developer API plan rate limits enabled",
          description:
            "Daily API usage is recorded atomically and blocked at the workspace plan limit.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-analytics",
          title: "Developer API key analytics enabled",
          description:
            "API keys track last-used time, per-key request analytics, and can be revoked by owners/admins.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-scopes",
          title: "Developer API key scopes enabled",
          description:
            "API keys can be limited to specific permissions such as messages, contacts, templates, campaigns, and webhooks.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-editing",
          title: "Developer API key editing enabled",
          description:
            "Owners and admins can rename active API keys and adjust scopes without exposing or rotating the secret.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-api-key-ip-expiry",
          title: "Developer API key IP allowlist and expiry enabled",
          description:
            "API keys can be restricted to trusted IP addresses and automatically blocked after expiry.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "developer-webhook-signatures",
          title: "Developer webhook signatures enabled",
          description:
            "Outbound developer webhooks are signed with HMAC SHA-256 and support signing secret rotation.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer Webhooks",
          actionHref: "/dashboard/developer/webhooks",
        }),
        buildItem({
          id: "developer-webhook-health-auto-disable",
          title: "Developer webhook health monitoring enabled",
          description:
            "Webhook endpoints track consecutive failures, last success/failure, and auto-disable after repeated delivery failures.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer Webhooks",
          actionHref: "/dashboard/developer/webhooks",
        }),
        buildItem({
          id: "developer-webhook-event-subscriptions",
          title: "Developer webhook event subscriptions enabled",
          description:
            "Developer webhooks can subscribe to selected event types and include a payload version for compatibility.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer Webhooks",
          actionHref: "/dashboard/developer/webhooks",
        }),
        buildItem({
          id: "developer-webhook-outbox",
          title: "Developer webhook outbox enabled",
          description:
            "Webhook events are stored and delivered asynchronously through a reliable outbox worker with retries and idempotency.",
          status: "complete",
          required: true,
          actionLabel: "Open Webhook Outbox",
          actionHref: "/dashboard/developer/webhooks/outbox",
        }),
        buildItem({
          id: "developer-webhook-outbox-detail",
          title: "Developer webhook outbox detail enabled",
          description:
            "Webhook outbox events can be inspected with payload, status, retry action, and linked delivery attempts.",
          status: "complete",
          required: true,
          actionLabel: "Open Webhook Outbox",
          actionHref: "/dashboard/developer/webhooks/outbox",
        }),
        buildItem({
          id: "developer-data-retention-cleanup",
          title: "Developer data retention cleanup enabled",
          description:
            "Old developer API logs, webhook delivery logs, and completed webhook outbox events are cleaned according to plan retention rules.",
          status: "complete",
          required: true,
          actionLabel: "Open Developer",
          actionHref: "/dashboard/developer",
        }),
        buildItem({
          id: "in-app-notifications",
          title: "In-app notification center enabled",
          description:
            "Workspace alerts are created for billing, wallet, developer webhook failures, and important system events.",
          status: "complete",
          required: true,
          actionLabel: "Open Notifications",
          actionHref: "/dashboard/notifications",
        }),
        buildItem({
          id: "per-user-notification-read-state",
          title: "Per-user notification read state enabled",
          description:
            "Company notifications are shared, but read/archive state and unread counts are tracked separately for each owner/admin.",
          status: "complete",
          required: true,
          actionLabel: "Open Notifications",
          actionHref: "/dashboard/notifications",
        }),
        buildItem({
          id: "notification-preferences",
          title: "Notification preferences enabled",
          description:
            "Owners and admins can control which alert types and severities appear in their in-app notification center.",
          status: "complete",
          required: true,
          actionLabel: "Open Notification Preferences",
          actionHref: "/dashboard/notifications/preferences",
        }),
        buildItem({
          id: "notification-retention-cleanup",
          title: "Notification retention cleanup enabled",
          description:
            "Read notifications are auto-archived and old resolved notifications are cleaned without deleting unread alerts.",
          status: "complete",
          required: true,
          actionLabel: "Open Notifications",
          actionHref: "/dashboard/notifications",
        }),
        buildItem({
          id: "notification-email-alerts",
          title: "Notification email alerts enabled",
          description:
            "Critical workspace notifications can be delivered by email according to per-user alert preferences.",
          status:
            process.env.NOTIFICATION_EMAILS_ENABLED === "true" &&
            process.env.SMTP_HOST
              ? "complete"
              : "pending",
          required: false,
          actionLabel: "Open Notification Preferences",
          actionHref: "/dashboard/notifications/preferences",
        }),
        buildItem({
          id: "notification-email-retry-smtp-test",
          title: "Notification email retry and SMTP testing enabled",
          description:
            "Admins can send a test email, inspect delivery status, and retry failed or skipped notification emails.",
          status:
            process.env.NOTIFICATION_EMAILS_ENABLED === "true" &&
            process.env.SMTP_HOST &&
            process.env.SMTP_USER &&
            process.env.SMTP_PASSWORD
              ? "complete"
              : "pending",
          required: false,
          actionLabel: "Open Email Deliveries",
          actionHref: "/dashboard/notifications/email-deliveries",
        }),
        buildItem({
          id: "notification-email-template-branding",
          title: "Notification email templates and safe links enabled",
          description:
            "Notification emails use branded HTML templates, escaped content, and absolute dashboard action URLs.",
          status: process.env.NEXT_PUBLIC_APP_URL ? "complete" : "pending",
          required: false,
          actionLabel: "Open Email Deliveries",
          actionHref: "/dashboard/notifications/email-deliveries",
        }),
        buildItem({
          id: "notification-email-maintenance",
          title: "Notification email maintenance enabled",
          description:
            "Stale pending email deliveries are recovered and old resolved email delivery rows are cleaned safely.",
          status: "complete",
          required: false,
          actionLabel: "Open Email Deliveries",
          actionHref: "/dashboard/notifications/email-deliveries",
        }),
        buildItem({
          id: "operations-health-dashboard",
          title: "Operations health dashboard enabled",
          description:
            "Admins can monitor database, Redis, queues, and maintenance jobs, with alerts for unhealthy background systems.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "github-actions-ci",
          title: "GitHub Actions CI enabled",
          description:
            "Every push and pull request validates Prisma, applies migrations to a CI database, runs checks, and builds the app.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "safe-production-deploy-script",
          title: "Safe production deploy script configured",
          description:
            "Production deploys enable maintenance mode, create and verify a database backup, run migrations, build the app, restart PM2, and verify health before resuming writes.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "production-deployment-history",
          title: "Production deployment history enabled",
          description:
            "Each production deploy records commit SHA, backup, migration, build, PM2 restart, health checks, and failure stage.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "safe-production-rollback-script",
          title: "Safe production rollback script configured",
          description:
            "Production rollbacks enable maintenance mode, create and verify a backup, checkout a target ref, rebuild, restart PM2, verify health, and record rollback history.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "safe-production-database-restore",
          title: "Safe production database restore configured",
          description:
            "Production database restores require explicit confirmation, verify backup checksum, create a pre-restore backup, stop PM2, run pg_restore, restart services, verify health, and record restore history.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "production-env-doctor",
          title: "Production environment doctor enabled",
          description:
            "Required secrets, unsafe public variables, dummy production credentials, payment config, SMTP config, and backup settings are audited before risky production operations.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "global-rate-limits",
          title: "Global abuse protection enabled",
          description:
            "Sensitive webhook, billing, campaign, contact import, and developer endpoints are protected by Redis-backed IP rate limits.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "security-headers-csp-cors",
          title: "Security headers, CSP, and API CORS enabled",
          description:
            "The app sends browser hardening headers, starts CSP in report-only mode, blocks iframe embedding, and limits public API CORS to approved origins.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "security-event-resolution-workflow",
          title: "Security event resolution workflow enabled",
          description:
            "Security events can be opened, resolved with notes, reopened, and audited from System Health.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "csrf-origin-guard",
          title: "CSRF origin guard enabled",
          description:
            "Authenticated dashboard and internal API mutations are protected from cross-site POST, PUT, PATCH, and DELETE requests using trusted Origin/Referer validation.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "production-operation-lock",
          title: "Production operation lock enabled",
          description:
            "Deploys, rollbacks, backups, restores, and maintenance operations are protected from running concurrently with a global expiring lock.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "worker-heartbeats",
          title: "Worker heartbeats enabled",
          description:
            "Background workers report heartbeat status and stale workers trigger system notifications.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "production-process-manager",
          title: "Production process manager configured",
          description:
            "PM2 configuration is available to run the web app and all required background workers with automatic restarts.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "production-healthcheck-endpoints",
          title: "Production healthcheck endpoints enabled",
          description:
            "Public and token-protected healthcheck endpoints are available for uptime monitoring and internal diagnostics.",
          status: process.env.HEALTHCHECK_TOKEN ? "complete" : "pending",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "database-backups",
          title: "Database backups configured",
          description:
            "PostgreSQL backups can run on schedule, old backups are cleaned, and failed backups create system notifications.",
          status:
            process.env.DATABASE_BACKUPS_ENABLED === "true" &&
            process.env.DATABASE_BACKUP_DIR
              ? "complete"
              : "pending",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "off-server-database-backup-storage",
          title: "Off-server database backup storage configured",
          description:
            "PostgreSQL backups can be uploaded to S3/R2-compatible remote storage with checksum and remote key tracking.",
          status:
            process.env.DATABASE_BACKUP_REMOTE_STORAGE_ENABLED === "true" &&
            process.env.S3_BACKUP_BUCKET &&
            process.env.S3_BACKUP_ACCESS_KEY_ID &&
            process.env.S3_BACKUP_SECRET_ACCESS_KEY
              ? "complete"
              : "pending",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "database-backup-verification",
          title: "Database backup verification enabled",
          description:
            "Latest PostgreSQL backups are verified for checksum integrity and remote object availability.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "system-maintenance-mode",
          title: "System maintenance mode enabled",
          description:
            "Owners can enable maintenance mode to show a dashboard banner and block critical write actions during incidents or restores.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "request-body-size-guard",
          title: "Request body size guard enabled",
          description:
            "Sensitive JSON, webhook, CSP report, campaign, and import endpoints reject oversized payloads before parsing and record security events.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "webhook-signature-verification",
          title: "Webhook signature verification enabled",
          description:
            "Meta and Razorpay webhook payloads are verified using raw-body HMAC signatures, replay attempts are detected, and signature failures are logged as security events.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "provider-webhook-idempotency",
          title: "Provider webhook idempotency enabled",
          description:
            "Meta and Razorpay webhook events are stored in an idempotency ledger so provider retries cannot duplicate messages, wallet credits, or subscription updates.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "safe-structured-logging",
          title: "Safe structured logging enabled",
          description:
            "Application logs and stored security metadata redact secrets, include request correlation IDs, and support JSON production logging.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "audit-log-integrity",
          title: "Tamper-evident audit logs enabled",
          description:
            "Audit logs are protected with a hash chain and can be verified from System Health to detect unauthorized database edits.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "multi-tenant-data-isolation",
          title: "Multi-tenant data isolation guard enabled",
          description:
            "Dynamic company-owned API resources are protected with tenant ownership checks so one company cannot access another company's data.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "secret-encryption-key-rotation",
          title: "Secret encryption key rotation enabled",
          description:
            "WhatsApp tokens and developer webhook secrets use versioned AES-256-GCM encryption with active key tracking and safe rotation.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "platform-admin-console",
          title: "Platform admin console enabled",
          description:
            "Internal platform admins can view all companies, billing status, WhatsApp connection status, usage, webhook failures, and audit history through a protected read-only ops console.",
          status: "complete",
          required: true,
          actionLabel: "Open Platform Admin",
          actionHref: "/dashboard/platform",
        }),
        buildItem({
          id: "incident-management-system",
          title: "Incident management system enabled",
          description:
            "Production-impacting security, worker, webhook, backup, billing, and platform failures can be tracked as incidents with acknowledgement, resolution, and timeline history.",
          status: "complete",
          required: true,
          actionLabel: "Open Incidents",
          actionHref: "/dashboard/incidents",
        }),
        buildItem({
          id: "dead-letter-queue-ui",
          title: "Dead letter queue UI enabled",
          description:
            "Failed BullMQ jobs are synced into a database-backed dead letter queue with dashboard inspection, retry, ignore, audit logs, and incident integration.",
          status: "complete",
          required: true,
          actionLabel: "Open Dead Letter Queue",
          actionHref: "/dashboard/system/dead-letter-queue",
        }),
        buildItem({
          id: "billing-reconciliation-guard",
          title: "Billing reconciliation guard enabled",
          description:
            "Wallet balances, usage ledgers, and wallet debit transactions are reconciled daily with dashboard visibility and incident creation for mismatches.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing Reconciliation",
          actionHref: "/dashboard/system/billing-reconciliation",
        }),
        buildItem({
          id: "public-api-v1-stability-layer",
          title: "Public API v1 stability layer enabled",
          description:
            "Customer-facing API v1 uses standardized responses, OpenAPI docs, request IDs, idempotent mutations, and duplicate retry protection.",
          status: "complete",
          required: true,
          actionLabel: "Open API v1 Docs",
          actionHref: "/dashboard/developer/api-v1",
        }),
        buildItem({
          id: "privacy-center",
          title: "Privacy Center enabled",
          description:
            "Admins can process contact data export and deletion requests with downloadable exports, anonymization, audit logs, expiry, retention cleanup, and incident handling.",
          status: "complete",
          required: true,
          actionLabel: "Open Privacy Center",
          actionHref: "/dashboard/system/privacy",
        }),
        buildItem({
          id: "public-privacy-portal",
          title: "Public Privacy Portal enabled",
          description:
            "Customers can submit verified data export and deletion requests from a public privacy page, with email confirmation and admin processing in Privacy Center.",
          status: "complete",
          required: true,
          actionLabel: "Open Privacy Portal",
          actionHref: "/privacy",
        }),
        buildItem({
          id: "data-retention-legal-hold",
          title: "Data retention and legal hold enabled",
          description:
            "Operational records are cleaned by policy with dry-run previews, legal hold protection, run ledger, scheduled maintenance, and incident creation on failures.",
          status: "complete",
          required: true,
          actionLabel: "Open Data Retention",
          actionHref: "/dashboard/system/data-retention",
        }),
        buildItem({
          id: "whatsapp-consent-ledger",
          title: "WhatsApp consent ledger enabled",
          description:
            "Contacts have opt-in and opt-out history with consent evidence, keyword updates, public API recording, CSV import support, and marketing template send guards.",
          status: "complete",
          required: true,
          actionLabel: "Open Contacts",
          actionHref: "/dashboard/contacts",
        }),
        buildItem({
          id: "compliance-evidence-center",
          title: "Compliance Evidence Center enabled",
          description:
            "Admins can generate audit-ready evidence packs for consent, privacy, security, retention, incidents, and audit logs with expiry cleanup and download audit trails.",
          status: "complete",
          required: true,
          actionLabel: "Open Compliance Evidence",
          actionHref: "/dashboard/system/compliance",
        }),
        buildItem({
          id: "legal-acceptance-gate",
          title: "Legal acceptance gate enabled",
          description:
            "Dashboard and Public API usage are blocked until companies accept the latest required Trust Center documents with version and SHA-256 evidence.",
          status: "complete",
          required: true,
          actionLabel: "Open Legal Acceptance",
          actionHref: "/dashboard/legal/acceptance",
        }),
        buildItem({
          id: "enterprise-rbac-v2",
          title: "Enterprise RBAC v2 enabled",
          description:
            "Companies can use system and custom roles with granular permissions, user role assignments, permission checks, audit logs, and strict-mode enforcement.",
          status: "complete",
          required: true,
          actionLabel: "Open Roles",
          actionHref: "/dashboard/team/roles",
        }),
        buildItem({
          id: "rbac-permission-guard-audit",
          title: "RBAC permission guard audit enabled",
          description:
            "Sensitive API routes are checked against a central permission registry so new endpoints cannot silently bypass RBAC enforcement.",
          status: "complete",
          required: true,
          actionLabel: "Open System Health",
          actionHref: "/dashboard/system/health",
        }),
        buildItem({
          id: "feature-entitlements",
          title: "Feature entitlements enabled",
          description:
            "Plan features are enforced by Free, Starter, Growth, and Business entitlement rules with company overrides, subscription blocking, and entitlement check logs.",
          status: "complete",
          required: true,
          actionLabel: "Open Feature Entitlements",
          actionHref: "/dashboard/system/entitlements",
        }),
        buildItem({
          id: "usage-quotas",
          title: "Usage quotas enabled",
          description:
            "Numeric plan limits are enforced with monthly/lifetime counters for contacts, templates, campaigns, compliance exports, team usage, and messaging.",
          status: "complete",
          required: true,
          actionLabel: "Open Usage Quotas",
          actionHref: "/dashboard/billing/usage-quotas",
        }),
        buildItem({
          id: "inbox-crm-v2",
          title: "Inbox CRM v2 enabled",
          description:
            "Inbox supports customer CRM profiles, lifecycle stages, activity timeline, assignment history, message/note timeline, and saved inbox views.",
          status: "complete",
          required: false,
          actionLabel: "Open Inbox",
          actionHref: "/dashboard/inbox",
        }),
        buildItem({
          id: "campaign-analytics-v2",
          title: "Campaign Analytics v2 enabled",
          description:
            "Campaigns have funnel analytics, reply attribution, opt-out tracking, usage cost, snapshots, scheduled sync, CSV export, and dashboard detail pages.",
          status: "complete",
          required: false,
          actionLabel: "Open Campaign Analytics",
          actionHref: "/dashboard/analytics/campaigns",
        }),
        buildItem({
          id: "uptime-monitoring-alerts",
          title: "Uptime monitoring and alert escalation enabled",
          description:
            "Production URLs and health endpoints are monitored for uptime, latency, failures, and recovery with incident creation and dashboard visibility.",
          status: "complete",
          required: true,
          actionLabel: "Open Uptime Monitors",
          actionHref: "/dashboard/system/uptime-monitors",
        }),
        buildItem({
          id: "public-status-page",
          title: "Public status page enabled",
          description:
            "Uptime monitoring components status and incident updates are visible on the public status page.",
          status: "complete",
          required: true,
          actionLabel: "Manage Status Page",
          actionHref: "/dashboard/system/status-page",
        }),
        buildItem({
          id: "subscription-expiry-guard",
          title: "Subscription expiry guard enabled",
          description:
            "Expired paid plans are marked past due automatically and blocked from sending until renewed.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "paid-plan-upgrade",
          title: "Paid plan upgrade enabled",
          description: isRazorpayCheckoutConfigured()
            ? "Paid plans activate only after Razorpay payment verification."
            : "Configure the Razorpay key ID and key secret before accepting plan payments.",
          status: isRazorpayCheckoutConfigured() ? "complete" : "pending",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "subscription-renewal-flow",
          title: "Subscription renewal flow enabled",
          description: isRazorpayCheckoutConfigured()
            ? "Past-due and expiring paid plans can renew through verified Razorpay checkout."
            : "Configure Razorpay credentials to enable paid plan renewals.",
          status: isRazorpayCheckoutConfigured() ? "complete" : "pending",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "subscription-cancel-resume",
          title: "Subscription cancel and resume enabled",
          description:
            "Paid plans can cancel at period end, resume before expiry, and downgrade automatically afterward.",
          status: "complete",
          required: true,
          actionLabel: "Open Billing",
          actionHref: "/dashboard/billing",
        }),
        buildItem({
          id: "meta-payment",
          title: "Meta payment method added",
          description: companySettings?.metaPaymentMethodAdded
            ? "Payment method confirmed in Meta Business Manager."
            : "Confirm a payment method is active in Meta Business Manager.",
          status: companySettings?.metaPaymentMethodAdded
            ? "complete"
            : "warning",
          required: true,
          actionLabel: "Update Confirmation",
          actionHref: "/dashboard/production-checklist#manual-confirmations",
        }),
        buildItem({
          id: "business-verification",
          title: "Business verification",
          description:
            companySettings?.metaBusinessVerificationStatus === "APPROVED"
              ? "Meta Business Verification is approved."
              : companySettings?.metaBusinessVerificationStatus === "SUBMITTED"
                ? "Verification is submitted and waiting for Meta approval."
                : companySettings?.metaBusinessVerificationStatus === "REJECTED"
                  ? "Verification was rejected. Review Meta requirements."
                  : "Confirm Meta Business Verification is submitted or approved.",
          status:
            companySettings?.metaBusinessVerificationStatus === "APPROVED"
              ? "complete"
              : companySettings?.metaBusinessVerificationStatus === "SUBMITTED"
                ? "warning"
                : "pending",
          required: true,
          actionLabel: "Update Confirmation",
          actionHref: "/dashboard/production-checklist#manual-confirmations",
        }),
      ],
    },
  ];

  const allItems = groups.flatMap((group) => group.items);
  const requiredItems = allItems.filter((item) => item.required);
  const completedItems = allItems.filter((item) => item.status === "complete");
  const completedRequiredItems = requiredItems.filter(
    (item) => item.status === "complete",
  );

  return {
    groups,
    summary: {
      totalItems: allItems.length,
      completedItems: completedItems.length,
      requiredItems: requiredItems.length,
      completedRequiredItems: completedRequiredItems.length,
      isProductionReady:
        completedRequiredItems.length === requiredItems.length,
    },
  };
}

export async function getProductionChecklistSettingsByCompany(
  companyId: string,
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      metaPaymentMethodAdded: true,
      metaBusinessVerificationStatus: true,
      productionChecklistNotes: true,
      productionChecklistUpdatedAt: true,
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  return company;
}

export async function updateProductionChecklistSettings(
  companyId: string,
  input: UpdateProductionChecklistSettingsInput,
) {
  return prisma.company.update({
    where: { id: companyId },
    data: {
      metaPaymentMethodAdded: input.metaPaymentMethodAdded,
      metaBusinessVerificationStatus: input.metaBusinessVerificationStatus,
      productionChecklistNotes: input.productionChecklistNotes || null,
      productionChecklistUpdatedAt: new Date(),
    },
    select: {
      metaPaymentMethodAdded: true,
      metaBusinessVerificationStatus: true,
      productionChecklistNotes: true,
      productionChecklistUpdatedAt: true,
    },
  });
}
