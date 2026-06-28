import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getOperationsHealth } from "@/server/services/operations-health.service";
import { getSystemMaintenanceMode } from "@/server/services/system-maintenance-mode.service";
import { getProductionDeploymentHistory } from "@/server/services/production-deployment.service";
import { getProductionRollbackHistory } from "@/server/services/production-rollback.service";
import { getActiveProductionOperationLock } from "@/server/services/production-operation-lock.service";
import { getDatabaseRestoreHistory } from "@/server/services/database-restore.service";
import { getProductionEnvAudit } from "@/server/services/production-env-audit.service";
import { getRateLimitHealth } from "@/server/services/rate-limit-health.service";
import { getSecurityHeaderHealth } from "@/server/services/security-header-health.service";
import { getCsrfOriginGuardHealth } from "@/server/services/csrf-origin-guard-health.service";
import { getRequestBodyGuardHealth } from "@/server/services/request-body-guard-health.service";
import { getWebhookSignatureSecurityHealth } from "@/server/services/webhook-signature-health.service";
import { getProviderWebhookEventHealth } from "@/server/services/provider-webhook-event.service";
import { getSafeLoggerHealth } from "@/server/services/safe-logger-health.service";
import { getTenantGuardHealth } from "@/server/services/tenant-guard-health.service";
import { getSecretEncryptionHealth } from "@/server/services/secret-encryption-health.service";
import { getPlatformAdminHealth } from "@/server/services/platform-admin-health.service";
import { getIncidentHealth } from "@/server/services/incident-health.service";
import { getDeadLetterQueueSummary } from "@/server/services/dead-letter-queue.service";
import { getBillingReconciliationHealth } from "@/server/services/billing-reconciliation.service";
import { getPublicApiV1Health } from "@/server/services/public-api-v1-health.service";
import { getInboxCrmHealth } from "@/server/services/inbox-crm-health.service";
import { getCampaignAnalyticsHealth } from "@/server/services/campaign-analytics-v2.service";
import { getUptimeMonitoringHealth } from "@/server/services/uptime-monitoring.service";
import { getStatusPageHealth } from "@/server/services/status-page.service";
import { getPrivacyCenterHealth } from "@/server/services/privacy-center.service";
import { getPublicPrivacyPortalHealth } from "@/server/services/public-privacy-portal.service";
import { getDataRetentionHealth } from "@/server/services/data-retention.service";
import { getConsentLedgerHealth } from "@/server/services/consent-ledger-health.service";
import { getComplianceEvidenceHealth } from "@/server/services/compliance-evidence.service";
import { getTrustCenterHealth } from "@/server/services/trust-center.service";
import { getRbacV2Health } from "@/server/services/rbac-v2.service";
import { getRbacPermissionAuditHealth } from "@/server/services/rbac-permission-audit.service";
import { getFeatureEntitlementHealth } from "@/server/services/feature-entitlement.service";
import { getBillingInvoiceHealth } from "@/server/services/billing-invoice.service";
import { getPlanUpgradeHealth } from "@/server/services/plan-upgrade.service";
import { getUsageQuotaAlertHealth } from "@/server/services/usage-quota-alert.service";
import { getUsageQuotaHealth } from "@/server/services/usage-quota.service";
import { getSubscriptionRenewalHealth } from "@/server/services/subscription-renewal.service";
import { getScheduledPlanChangeHealth } from "@/server/services/scheduled-plan-change.service";
import { getPlanCheckoutReconciliationHealth } from "@/server/services/plan-checkout-reconciliation.service";
import { getBillingOpsHealth } from "@/server/services/billing-ops.service";
import { getBillingRefundHealth } from "@/server/services/billing-refund.service";
import { getBillingRefundReconciliationHealth } from "@/server/services/billing-refund-reconciliation.service";
import { getBillingProfileHealth } from "@/server/services/company-billing-profile.service";
import { getBillingDocumentEmailHealth } from "@/server/services/billing-document-email.service";
import { getBillingPdfHealth } from "@/server/services/billing-document-pdf.service";
import { getBillingAnalyticsHealth } from "@/server/services/billing-analytics.service";
import { getTransactionalEmailHealth } from "@/server/services/email-health.service";
import { getPlatformCompanyControlHealth } from "@/server/services/platform-company-control.service";
import { getCompanyPlanAssignmentHealth } from "@/server/services/company-plan-assignment.service";
import { getContactSegmentBuilderHealth } from "@/server/services/contact-segment-builder.service";
import { getTemplateVariableMappingHealth } from "@/server/services/template-variable-mapping.service";
import { getCampaignLaunchHealth } from "@/server/services/campaign-launch-orchestrator.service";
import { getCampaignFailureIntelligenceHealth } from "@/server/services/campaign-failure-intelligence.service";
import { getCampaignThroughputGuardHealth } from "@/server/services/campaign-throughput-guard.service";
import { getCampaignCompletionReportHealth } from "@/server/services/campaign-completion-report.service";
import { getCampaignReplyAttributionHealth } from "@/server/services/campaign-reply-attribution.service";
import { getTimelineBackfillHealth } from "@/server/services/timeline-backfill.service";
import { getContactImportHealth } from "@/server/services/contact-import.service";
import { prisma } from "@/lib/prisma";
import MaintenanceModeCard from "./maintenance-mode-card";
import RunDatabaseBackupButton from "./run-database-backup-button";
import VerifyLatestBackupButton from "./verify-latest-backup-button";
import ForceReleaseOperationLockButton from "./force-release-operation-lock-button";
import VerifyAuditIntegrityButton from "./verify-audit-integrity-button";
import { ReconcilePlanCheckoutsButton } from "@/app/dashboard/billing/reconciliation-actions";

function statusClass(ok: boolean) {
  return ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700";
}

function queueStatusClass(isHealthy: boolean) {
  return isHealthy ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700";
}

export default async function SystemHealthPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  if (
    context.membership.role !== "OWNER" &&
    context.membership.role !== "ADMIN"
  ) {
    redirect("/dashboard");
  }

  const [
    health,
    maintenanceMode,
    deployments,
    rollbacks,
    operationLock,
    restoreRuns,
    envAudit,
    rateLimits,
    securityHeaders,
    securityEvents,
    csrfGuard,
    bodyGuard,
    webhookSignatures,
    providerWebhooks,
    safeLogger,
    tenantGuard,
    secretEncryption,
    platformAdmin,
    incidents,
    deadLetterQueue,
    billingReconciliation,
    publicApiV1,
    inboxCrm,
    campaignAnalytics,
    uptimeMonitoring,
    statusPage,
    privacyCenter,
    publicPrivacyPortal,
    dataRetention,
    consentLedger,
    complianceEvidence,
    trustCenter,
    rbacV2,
    rbacPermissionAudit,
    featureEntitlements,
    usageQuotas,
    usageQuotaAlerts,
    planUpgrades,
    billingInvoices,
    subscriptionRenewals,
    scheduledPlanChanges,
    planCheckoutReconciliation,
    billingOps,
    billingRefunds,
    billingRefundReconciliation,
    billingProfiles,
    billingDocumentEmails,
    billingPdfs,
    billingAnalytics,
    transactionalEmail,
    platformCompanyControl,
    companyPlanAssignment,
    contactSegments,
    templateVariableMapping,
    campaignLaunch,
    campaignFailureIntelligence,
    campaignThroughput,
    campaignCompletionReports,
    campaignReplyAttribution,
    timelineBackfill,
    contactImport,
  ] = await Promise.all([
    getOperationsHealth(),
    getSystemMaintenanceMode(),
    getProductionDeploymentHistory({ limit: 10 }),
    getProductionRollbackHistory({ limit: 10 }),
    getActiveProductionOperationLock(),
    getDatabaseRestoreHistory({ limit: 10 }),
    getProductionEnvAudit(),
    getRateLimitHealth(),
    getSecurityHeaderHealth(),
    prisma.securityEvent.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 10,
    }),
    getCsrfOriginGuardHealth(),
    getRequestBodyGuardHealth(),
    getWebhookSignatureSecurityHealth(),
    getProviderWebhookEventHealth(),
    getSafeLoggerHealth(),
    getTenantGuardHealth(),
    getSecretEncryptionHealth(),
    getPlatformAdminHealth(),
    getIncidentHealth(),
    getDeadLetterQueueSummary(),
    getBillingReconciliationHealth(),
    getPublicApiV1Health(),
    getInboxCrmHealth(),
    getCampaignAnalyticsHealth(),
    getUptimeMonitoringHealth(),
    getStatusPageHealth(),
    getPrivacyCenterHealth(),
    getPublicPrivacyPortalHealth(),
    getDataRetentionHealth(),
    getConsentLedgerHealth(),
    getComplianceEvidenceHealth(),
    getTrustCenterHealth(),
    getRbacV2Health(),
    getRbacPermissionAuditHealth(),
    getFeatureEntitlementHealth(),
    getUsageQuotaHealth(),
    getUsageQuotaAlertHealth(),
    getPlanUpgradeHealth(),
    getBillingInvoiceHealth(),
    getSubscriptionRenewalHealth(),
    getScheduledPlanChangeHealth(),
    getPlanCheckoutReconciliationHealth(),
    getBillingOpsHealth(),
    getBillingRefundHealth(),
    getBillingRefundReconciliationHealth(),
    getBillingProfileHealth(),
    getBillingDocumentEmailHealth(),
    getBillingPdfHealth(),
    getBillingAnalyticsHealth(),
    getTransactionalEmailHealth(),
    getPlatformCompanyControlHealth(),
    getCompanyPlanAssignmentHealth(),
    getContactSegmentBuilderHealth(),
    getTemplateVariableMappingHealth(),
    getCampaignLaunchHealth(),
    getCampaignFailureIntelligenceHealth(),
    getCampaignThroughputGuardHealth(),
    getCampaignCompletionReportHealth(),
    getCampaignReplyAttributionHealth(),
    getTimelineBackfillHealth(),
    getContactImportHealth(),
  ]);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>

          <p className="mt-2 text-sm text-gray-600">
            Monitor database, Redis, queues, and maintenance jobs.
          </p>
        </div>

        <MaintenanceModeCard maintenanceMode={maintenanceMode} />

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Contact Import
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Imports contacts with consent mapping and row-level validation.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                contactImport.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {contactImport.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Jobs</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactImport.jobs}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Completed</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactImport.completed}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactImport.failed}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Imported Rows</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactImport.importedRows}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            Max rows: {contactImport.maxRows} · Consent proof required:{" "}
            {contactImport.requireConsentProofForGranted ? "Yes" : "No"}
          </p>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Timeline Backfill
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Tracks campaign CRM timeline activity dedupe readiness and backfilled campaign events.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(timelineBackfill.isHealthy)}`}
            >
              {timelineBackfill.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Dedupe Ready</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {timelineBackfill.dedupeReady ? "Yes" : "No"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Deduped Rows</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {timelineBackfill.dedupedActivities}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Campaign Activities</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {timelineBackfill.campaignTimelineActivities}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Link
              href="/dashboard/settings/timeline"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open timeline backfill
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Reply Attribution
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Attributes inbound replies to campaigns, classifies reply intent, tracks conversions, and creates follow-up tasks.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(campaignReplyAttribution.isHealthy)}`}
            >
              {campaignReplyAttribution.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Attributed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignReplyAttribution.attributed24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Positive / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignReplyAttribution.positive24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Opt-outs / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignReplyAttribution.optOut24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Open Tasks</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignReplyAttribution.openTasks}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Link
              href="/dashboard/campaigns/replies"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open campaign replies
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Completion Reports
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Final reports with delivery, read, failure, cost, replies, opt-outs, and CSV evidence.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(campaignCompletionReports.isHealthy)}`}
            >
              {campaignCompletionReports.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Reports Total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignCompletionReports.reportsTotal}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Generated / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignCompletionReports.generated24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignCompletionReports.failed24h}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Link
              href="/dashboard/campaigns/reports"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open campaign reports
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Throughput Guard
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Adaptive send speed, rate-limit protection, and WABA quality safety for bulk campaigns.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(campaignThroughput.isHealthy)}`}
            >
              {campaignThroughput.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Slow Campaigns</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignThroughput.slowCampaigns}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Paused Campaigns</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignThroughput.pausedCampaigns}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Rate Limits / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignThroughput.rateLimitEvents24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Quality Events / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignThroughput.qualityEvents24h}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Link
              href="/dashboard/campaigns/throughput"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open campaign throughput
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Failure Intelligence
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Groups failed WhatsApp messages by root cause and controls safe retry.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(campaignFailureIntelligence.isHealthy)}`}
            >
              {campaignFailureIntelligence.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Open Critical</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignFailureIntelligence.openCritical}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Safe Retry Groups</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignFailureIntelligence.safeRetryGroups}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed Runs / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignFailureIntelligence.failedRuns24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Stale Open</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignFailureIntelligence.staleOpen}
              </p>
            </div>
          </div>
          <div className="mt-5">
            <Link
              href="/dashboard/campaigns/failures"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open failure intelligence
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Launch Orchestrator
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Connects segment selection, variable mapping, dry run, wallet reservation, message queueing, and campaign control.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(campaignLaunch.isHealthy)}`}
            >
              {campaignLaunch.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Queuing</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignLaunch.queuing}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Running</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignLaunch.running}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Queued / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignLaunch.queued24h}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignLaunch.failed24h}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Segment Builder
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Reusable contact segments for campaign recipient selection.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(contactSegments.isHealthy)}`}
            >
              {contactSegments.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Active Segments</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactSegments.activeSegments}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Disabled Segments</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactSegments.disabledSegments}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Previews / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {contactSegments.previews24h}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Template Variable Mapping
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Maps WhatsApp template variables to contact fields and system values.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(templateVariableMapping.isHealthy)}`}
            >
              {templateVariableMapping.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Active Mappings</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {templateVariableMapping.activeMappings}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Disabled Mappings</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {templateVariableMapping.disabledMappings}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Mapped Templates</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {templateVariableMapping.mappedTemplates}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Platform Company Control
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Platform admin can manage companies, partners, suspension, and notes.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                platformCompanyControl.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {platformCompanyControl.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Companies</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {platformCompanyControl.totalCompanies}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Suspended</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {platformCompanyControl.suspendedCompanies}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Disabled</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {platformCompanyControl.disabledCompanies}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Notes</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {platformCompanyControl.notes}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/platform/companies"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open platform companies
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Company Plan Assignment
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Default trial plans, active access gates, and platform-assigned
                company plans.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                companyPlanAssignment.isHealthy,
              )}`}
            >
              {companyPlanAssignment.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            {[
              ["Current", companyPlanAssignment.currentPlans],
              ["Trial", companyPlanAssignment.trialPlans],
              ["Active", companyPlanAssignment.activePlans],
              ["Expired", companyPlanAssignment.expiredPlans],
              ["Suspended", companyPlanAssignment.suspendedPlans],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href="/platform/companies"
              className="text-sm font-medium text-gray-900 underline"
            >
              Manage platform plans
            </Link>
            <Link
              href="/dashboard/account/plan"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open current plan
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Feature Entitlements</h2>
              <p className="mt-1 text-sm text-gray-600">
                Plan feature matrix, company-specific overrides, and subscription-based feature gates.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(featureEntitlements.isHealthy)}`}>
              {featureEntitlements.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Plan Rows", featureEntitlements.planEntitlements],
              ["Expected Rows", featureEntitlements.expectedPlanEntitlements],
              ["Overrides", featureEntitlements.activeOverrides],
              ["Blocked / 24h", featureEntitlements.blocked24h],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/dashboard/system/entitlements" className="text-sm font-medium text-gray-900 underline">
              Open entitlements
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Scheduled Plan Changes
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Applies cancel-at-period-end, downgrades, and scheduled billing
                plan changes.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                scheduledPlanChanges.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {scheduledPlanChanges.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Scheduled</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {scheduledPlanChanges.scheduled}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Applied / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {scheduledPlanChanges.applied24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {scheduledPlanChanges.failed24h}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/subscription"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open subscription management
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Subscription Renewals
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Renewal reminders, past-due grace period, and automatic
                downgrade protection.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                subscriptionRenewals.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {subscriptionRenewals.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Events / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {subscriptionRenewals.events24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Past Due</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {subscriptionRenewals.pastDueCompanies}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Expiring 7 Days</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {subscriptionRenewals.paidCompaniesExpiring7d}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Grace Days</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {subscriptionRenewals.graceDays}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/subscription-renewals"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open subscription renewals
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Usage Quotas
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Enforces numeric plan limits for contacts, campaigns, templates, exports, team usage, and messages.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                usageQuotas.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {usageQuotas.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Counters</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {usageQuotas.counters}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Events / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {usageQuotas.events24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Strict Mode</p>
              <p className="mt-1 font-semibold text-gray-900">
                {usageQuotas.strictMode ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Companies Missing Counters</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {usageQuotas.companiesWithoutCounters}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link href="/dashboard/billing/usage-quotas" className="text-sm font-medium text-gray-900 underline">
              Open usage quotas
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Usage Quota Alerts
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Warns companies before quota limits block contacts, campaigns, exports, or messages.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                usageQuotaAlerts.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {usageQuotaAlerts.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Active Alerts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {usageQuotaAlerts.activeAlerts}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Critical</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {usageQuotaAlerts.criticalAlerts}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Created / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {usageQuotaAlerts.alerts24h}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link href="/dashboard/billing/usage-quotas" className="text-sm font-medium text-gray-900 underline">
              Open quota alerts
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Plan Upgrade Checkout
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Self-serve plan upgrades with Razorpay verification and plan change ledger.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                planUpgrades.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {planUpgrades.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Created / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planUpgrades.created24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Paid / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planUpgrades.paid24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planUpgrades.failed24h}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link href="/dashboard/billing/upgrade" className="text-sm font-medium text-gray-900 underline">
              Open upgrade checkout
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Plan Checkout Reconciliation
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Completes paid plan upgrades from webhooks and expires abandoned checkout sessions.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                planCheckoutReconciliation.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {planCheckoutReconciliation.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Open Checkouts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planCheckoutReconciliation.createdOpen}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Expired / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planCheckoutReconciliation.expired24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planCheckoutReconciliation.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Manual Review / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {planCheckoutReconciliation.manualReview24h}
              </p>
            </div>
          </div>

          <div className="mt-5 border-t pt-5">
            <ReconcilePlanCheckoutsButton />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Ops Manual Review
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Reviews captured-payment reconciliation issues and protects manual checkout approval.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingOps.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingOps.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Open Reviews</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingOps.manualReviewOpen}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Approved / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingOps.approved24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Rejected / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingOps.rejected24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Stale Reviews</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingOps.staleReviews}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/ops"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open Billing Ops
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Refunds
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Refund processing, credit notes, Razorpay refund IDs, and downgrade-on-full-refund safety.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingRefunds.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingRefunds.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Processing</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefunds.processing}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Processed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefunds.processed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefunds.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Credit Notes / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefunds.creditNotes24h}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/refunds"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open refunds
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Refund Reconciliation
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Tracks Razorpay refund status via webhooks and scheduled reconciliation.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingRefundReconciliation.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingRefundReconciliation.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Processing</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefundReconciliation.processing}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Stale Processing</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefundReconciliation.staleProcessing}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Processed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefundReconciliation.processed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingRefundReconciliation.failed24h}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/refunds"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open refunds
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Invoices
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Invoice and receipt ledger for plan upgrades, payments, and billing history.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingInvoices.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingInvoices.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Paid / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingInvoices.paid24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingInvoices.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingInvoices.totalPaid}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link href="/dashboard/billing/invoices" className="text-sm font-medium text-gray-900 underline">
              Open invoices
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Profiles
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Customer billing details used for invoices, receipts, refunds, and credit notes.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingProfiles.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingProfiles.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Profiles</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingProfiles.profiles}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Missing Legal Name</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingProfiles.missingLegalName}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Missing Billing Email</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingProfiles.missingBillingEmail}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Verified</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingProfiles.verified}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/profile"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open billing profile
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Document Emails
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Sends invoices and credit notes by email and tracks delivery history.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingDocumentEmails.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingDocumentEmails.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Sent / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingDocumentEmails.sent24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingDocumentEmails.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Queued</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingDocumentEmails.queued}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Auto Send</p>
              <p className="mt-1 font-semibold text-gray-900">
                {billingDocumentEmails.autoSendEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/email-deliveries"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open email deliveries
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Transactional Email
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Sends team invites and future system emails.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                transactionalEmail.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {transactionalEmail.isHealthy ? "Healthy" : "Needs SMTP"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Email Enabled</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {transactionalEmail.enabled ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Missing Config</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {transactionalEmail.missing.length > 0
                  ? transactionalEmail.missing.join(", ")
                  : "None"}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing PDFs
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Generates invoice and credit note PDFs for download and email attachments.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingPdfs.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingPdfs.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Generated / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingPdfs.generated24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingPdfs.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Total Generated</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingPdfs.totalGenerated}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Email Attachments</p>
              <p className="mt-1 font-semibold text-gray-900">
                {billingPdfs.attachToEmails ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Analytics
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Revenue snapshots, MRR, ARR, refunds, and plan distribution metrics.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingAnalytics.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingAnalytics.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Generated / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingAnalytics.generated24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingAnalytics.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Latest Daily</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {billingAnalytics.latestDailyAt?.toLocaleString() ?? "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Latest Monthly</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {billingAnalytics.latestMonthlyAt?.toLocaleString() ?? "-"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/billing/analytics"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open billing analytics
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">RBAC Guard Coverage</h2>
              <p className="mt-1 text-sm text-gray-600">
                Audits sensitive API routes for permission registry coverage and guard usage.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(rbacPermissionAudit.isHealthy)}`}>
              {rbacPermissionAudit.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Total Routes", rbacPermissionAudit.latestRun?.totalRoutes ?? 0],
              ["Guarded", rbacPermissionAudit.latestRun?.guardedRoutes ?? 0],
              ["Missing Registry", rbacPermissionAudit.latestRun?.missingRegistry ?? 0],
              ["Missing Guards", rbacPermissionAudit.latestRun?.missingGuards ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Enterprise RBAC</h2>
              <p className="mt-1 text-sm text-gray-600">
                Custom roles, permission matrix, and user role assignments.
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(rbacV2.isHealthy)}`}>
              {rbacV2.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Roles", rbacV2.roles],
              ["Assignments", rbacV2.assignments],
              ["Strict Mode", rbacV2.strictMode ? "Yes" : "No"],
              ["Companies Missing Roles", rbacV2.companiesWithoutRoles],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-5">
            <Link href="/dashboard/team/roles" className="text-sm font-medium text-gray-900 underline">
              Open roles
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Trust Center</h2>
              <p className="mt-1 text-sm text-gray-600">
                Published legal documents, required coverage, and acceptance evidence.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                trustCenter.isHealthy,
              )}`}
            >
              {trustCenter.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Published Docs", trustCenter.publishedDocuments],
              ["Required Docs", trustCenter.requiredDocuments],
              ["Acceptances / 24h", trustCenter.acceptances24h],
              ["Draft Docs", trustCenter.draftDocuments],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/legal/acceptance"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open legal acceptance
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Compliance Evidence Center
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Audit-ready exports for consent, privacy, security, retention, incidents, and audit logs.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                complianceEvidence.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {complianceEvidence.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Pending", complianceEvidence.pending],
              ["Completed / 24h", complianceEvidence.completed24h],
              ["Failed / 24h", complianceEvidence.failed24h],
              ["Expired Files", complianceEvidence.expiredFiles],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/system/compliance"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open Compliance Evidence Center
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Consent Ledger
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                WhatsApp opt-in proof, opt-out history, and marketing send protection.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                consentLedger.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {consentLedger.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Marketing Granted", consentLedger.grantedMarketing],
              ["Marketing Revoked", consentLedger.revokedMarketing],
              ["Unknown", consentLedger.unknownMarketing],
              ["Events / 24h", consentLedger.events24h],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Data Retention
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Automated cleanup policies, dry-run previews, and legal hold protection.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                dataRetention.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {dataRetention.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Active Policies", dataRetention.activePolicies],
              ["Dry Run", dataRetention.dryRun ? "Yes" : "No"],
              ["Failed Runs / 24h", dataRetention.failedRuns24h],
              ["Legal Holds", dataRetention.activeLegalHolds],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/system/data-retention"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open data retention
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Privacy Center
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Contact data export, deletion requests, export file expiry, and privacy request retention.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                privacyCenter.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {privacyCenter.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Pending", privacyCenter.pending],
              ["Completed / 24h", privacyCenter.completed24h],
              ["Failed / 24h", privacyCenter.failed24h],
              ["Expired Files", privacyCenter.expiredFiles],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/system/privacy"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open Privacy Center
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Public Privacy Portal
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Public verified intake for contact export and deletion requests.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                publicPrivacyPortal.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {publicPrivacyPortal.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["Pending Verifications", publicPrivacyPortal.pending],
              ["Used / 24h", publicPrivacyPortal.used24h],
              ["Failed / 24h", publicPrivacyPortal.failed24h],
              ["Expired / 24h", publicPrivacyPortal.expired24h],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            <a
              href="/privacy"
              target="_blank"
              className="text-sm font-medium text-gray-900 underline"
            >
              Public privacy page
            </a>

            <Link
              href="/dashboard/system/privacy"
              className="text-sm font-medium text-gray-900 underline"
            >
              Privacy Center
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Uptime Monitoring
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Public URL, health endpoint, deep health endpoint, latency, and downtime checks.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                uptimeMonitoring.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {uptimeMonitoring.isHealthy ? "Healthy" : "Down/Incident"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Active Monitors</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {uptimeMonitoring.activeMonitors}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Down</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {uptimeMonitoring.downMonitors}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed Checks / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {uptimeMonitoring.failedChecks24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Open Incidents</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {uptimeMonitoring.openIncidentMonitors}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/system/uptime-monitors"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open uptime monitors
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Public Status Page
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Customer-facing trust page for uptime, components, incidents, and maintenance.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusPage.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-yellow-50 text-yellow-700"
              }`}
            >
              {statusPage.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Configured</p>
              <p className="mt-1 font-semibold text-gray-900">
                {statusPage.configured ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Active Incidents</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {statusPage.activeIncidents}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Degraded</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {statusPage.degradedComponents}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Outages</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {statusPage.outageComponents}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-4">
            <a
              href="/status"
              target="_blank"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open status page
            </a>
            <Link
              href="/dashboard/system/status-page"
              className="text-sm font-medium text-gray-900 underline"
            >
              Manage status page
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Inbox CRM v2
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Customer profiles, activity timeline, assignment history, and saved views.
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Enabled
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Activities / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {inboxCrm.activities24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Saved Views</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {inboxCrm.savedViews}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Profiled Contacts</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {inboxCrm.contactsWithLifecycle}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Campaign Analytics v2
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Funnel, reply, opt-out, and cost snapshots for campaigns.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                campaignAnalytics.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {campaignAnalytics.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Synced / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignAnalytics.synced24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed Snapshots</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignAnalytics.failedSnapshots}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Stale Snapshots</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {campaignAnalytics.staleSnapshots}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/analytics/campaigns"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open campaign analytics
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Public API v1</h2>
              <p className="mt-1 text-sm text-gray-600">
                Stable developer API with standardized errors and idempotent mutations.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                publicApiV1.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {publicApiV1.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            {[
              ["API v1", publicApiV1.enabled ? "Enabled" : "Disabled"],
              ["Idempotency", publicApiV1.idempotencyEnabled ? "Enabled" : "Disabled"],
              ["Completed / 24h", publicApiV1.completed24h],
              ["Stale Processing", publicApiV1.processingStale],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-4">
            <Link href="/dashboard/developer/api-v1" className="text-sm font-medium text-gray-900 underline">
              Open API docs
            </Link>
            <a href="/api/v1/openapi.json" className="text-sm font-medium text-gray-900 underline">
              OpenAPI JSON
            </a>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Billing Reconciliation
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Verifies wallet balances, message usage ledgers, and debit transactions.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                billingReconciliation.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {billingReconciliation.isHealthy ? "Healthy" : "Mismatch Found"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Latest Run</p>
              <p className="mt-1 font-semibold text-gray-900">
                {billingReconciliation.latest?.status ?? "Never Run"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Critical Issues</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingReconciliation.unresolvedCritical}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">High Issues</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {billingReconciliation.unresolvedHigh}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/system/billing-reconciliation"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open billing reconciliation
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Dead Letter Queue
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Failed BullMQ jobs that need retry, investigation, or dismissal.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                deadLetterQueue.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {deadLetterQueue.isHealthy ? "Healthy" : "Failed Jobs"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["Failed", deadLetterQueue.failed],
              ["Retried", deadLetterQueue.retried],
              ["Ignored", deadLetterQueue.ignored],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/system/dead-letter-queue"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open dead letter queue
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Audit Log Integrity
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Audit logs are hash-chained so unauthorized edits become detectable.
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Enabled
            </span>
          </div>

          <div className="mt-5">
            <VerifyAuditIntegrityButton />
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Incident Management
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Tracks production incidents from security, workers, backups, webhooks, and platform events.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                incidents.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {incidents.isHealthy ? "Healthy" : "Active Incidents"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Open</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {incidents.open}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Acknowledged</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {incidents.acknowledged}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Critical Open</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {incidents.criticalOpen}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">High Open</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {incidents.highOpen}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <Link
              href="/dashboard/incidents"
              className="text-sm font-medium text-gray-900 underline"
            >
              Open incidents
            </Link>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Platform Admin Console
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Internal super-admin console for cross-company operations visibility.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                platformAdmin.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {platformAdmin.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Configured Admins</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {platformAdmin.configuredAdminCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Console URL</p>
              <p className="mt-1 font-semibold text-gray-900">
                /dashboard/platform
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Sensitive Secret Encryption
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Versioned AES-256-GCM encryption with active key tracking and rotation.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                secretEncryption.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {secretEncryption.isHealthy ? "Healthy" : "Needs Rotation"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Active Key</p>
              <p className="mt-1 break-all font-semibold text-gray-900">
                {secretEncryption.activeKeyId}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Key Count</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {secretEncryption.keyCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">WA Unrotated</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {secretEncryption.whatsapp.unrotated}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Webhook Unrotated</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {secretEncryption.developerWebhooks.unrotated}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Multi-tenant Data Isolation Guard
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Prevents users from accessing resources that belong to another company.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tenantGuard.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {tenantGuard.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Protected Entity</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {tenantGuard.protectedEntities.map((entity) => (
                  <tr key={entity}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {entity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Production Environment Doctor
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Validates required secrets, unsafe public variables, backup config,
                payment config, and healthcheck token strength.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                envAudit.isHealthy ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {envAudit.isHealthy ? "Healthy" : "Needs Attention"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Passed</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {envAudit.passedCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Warnings</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {envAudit.warningCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {envAudit.failedCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Mode</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {envAudit.isProduction ? "Production" : "Non-prod"}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Check</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {envAudit.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          item.severity === "PASS"
                            ? "bg-green-50 text-green-700"
                            : item.severity === "WARNING"
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.severity}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-900">
                      {item.title}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {item.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Safe Logging
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Structured logs with automatic secret redaction and request correlation.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                safeLogger.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {safeLogger.redactionEnabled ? "Redaction On" : "Redaction Off"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Level</p>
              <p className="mt-1 font-semibold text-gray-900">
                {safeLogger.level}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Format</p>
              <p className="mt-1 font-semibold text-gray-900">
                {safeLogger.format}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Request ID Header</p>
              <p className="mt-1 font-semibold text-gray-900">
                {safeLogger.requestIdHeader}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Redaction Rules</p>
              <p className="mt-1 font-semibold text-gray-900">
                {safeLogger.sensitiveKeywordCount}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Provider Webhook Processing
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Idempotency and processing ledger for Meta and Razorpay webhook events.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                providerWebhooks.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {providerWebhooks.isHealthy ? "Healthy" : "Needs Review"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Events / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {providerWebhooks.total24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Failed / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {providerWebhooks.failed24h}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Stale Processing</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {providerWebhooks.processingStale}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Duplicates / 24h</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {providerWebhooks.duplicateSeen24h}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3">Error</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {providerWebhooks.recentEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          event.status === "SUCCEEDED"
                            ? "bg-green-50 text-green-700"
                            : event.status === "FAILED"
                              ? "bg-red-50 text-red-700"
                              : "bg-yellow-50 text-yellow-700"
                        }`}
                      >
                        {event.status}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-gray-900">
                      {event.provider}
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {event.eventType ?? "-"}
                      </div>
                      <div className="max-w-xs truncate font-mono text-xs text-gray-500">
                        {event.providerEventId ?? event.bodySha256}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {event.attempts}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {event.receivedAt.toLocaleString()}
                    </td>

                    <td className="max-w-xs truncate px-4 py-3 text-gray-600">
                      {event.lastErrorMessage ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Webhook Signature Verification
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Verifies Meta and Razorpay webhook signatures before processing payloads.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                webhookSignatures.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {webhookSignatures.isHealthy ? "Healthy" : "Needs Config"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Verification</p>
              <p className="mt-1 font-semibold text-gray-900">
                {webhookSignatures.enabled ? "Enabled" : "Disabled"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Meta Secret</p>
              <p className="mt-1 font-semibold text-gray-900">
                {webhookSignatures.meta.configured ? "Configured" : "Missing"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Razorpay Secret</p>
              <p className="mt-1 font-semibold text-gray-900">
                {webhookSignatures.razorpay.configured
                  ? "Configured"
                  : "Missing"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Replay Mode</p>
              <p className="mt-1 font-semibold text-gray-900">
                {webhookSignatures.replayGuardMode}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Request Body Guard
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Blocks oversized JSON, webhook, CSP report, campaign, and import
                payloads before they can consume app memory.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                bodyGuard.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {bodyGuard.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Payload Type</th>
                  <th className="px-4 py-3">Max Bytes</th>
                  <th className="px-4 py-3">Approx MB</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {Object.entries(bodyGuard.limits).map(([name, bytes]) => (
                  <tr key={name}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {name}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {bytes}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {(bytes / 1024 / 1024).toFixed(2)} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Global Rate Limits
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Redis-backed IP limits for sensitive write and webhook endpoints.
              </p>
            </div>

            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              Enabled
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Limit</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {rateLimits.rules.map((rule) => (
                  <tr key={rule.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {rule.id}
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {rule.windowSeconds}s
                    </td>

                    <td className="px-4 py-3 text-gray-600">
                      {rule.maxRequests} requests
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Security Headers
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Browser hardening headers, CSP mode, HSTS, and public API CORS settings.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                securityHeaders.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {securityHeaders.isHealthy ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">CSP Mode</p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {securityHeaders.cspMode}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">HSTS</p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {securityHeaders.hstsEnabled ? "Enabled" : "Off"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Headers</p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {securityHeaders.headerCount}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">CORS Prefixes</p>

              <p className="mt-1 text-xl font-bold text-gray-900">
                {securityHeaders.corsPathPrefixes.length}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Header</th>

                  <th className="px-4 py-3">Value Preview</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {securityHeaders.headers.map((header) => (
                  <tr key={header.name}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {header.name}
                    </td>

                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {header.valuePreview}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">
              Allowed CORS Origins
            </p>

            <p className="mt-1 break-all text-sm text-gray-600">
              {securityHeaders.allowedCorsOrigins.length > 0
                ? securityHeaders.allowedCorsOrigins.join(", ")
                : "No browser origins configured for public API CORS."}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                CSRF Origin Guard
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Blocks cross-site mutating browser requests to authenticated dashboard
                and internal API routes.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                csrfGuard.isHealthy
                  ? "bg-green-50 text-green-700"
                  : "bg-yellow-50 text-yellow-700"
              }`}
            >
              {csrfGuard.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Protected Methods</p>

              <p className="mt-1 font-semibold text-gray-900">
                {csrfGuard.protectedMethods.join(", ")}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Trusted Origins</p>

              <p className="mt-1 font-semibold text-gray-900">
                {csrfGuard.trustedOrigins.length}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Missing Origin</p>

              <p className="mt-1 font-semibold text-gray-900">
                {csrfGuard.allowMissingOrigin ? "Allowed" : "Blocked"}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium text-gray-900">Trusted Origins</p>

              <p className="mt-2 break-all text-sm text-gray-600">
                {csrfGuard.trustedOrigins.length > 0
                  ? csrfGuard.trustedOrigins.join(", ")
                  : "No trusted origins configured."}
              </p>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium text-gray-900">Excluded Prefixes</p>

              <p className="mt-2 break-all text-sm text-gray-600">
                {csrfGuard.excludedPathPrefixes.join(", ")}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Production Operation Lock
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Prevents deploys, rollbacks, backups, and maintenance operations from
                running at the same time.
              </p>
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                operationLock && !operationLock.isExpired
                  ? "bg-yellow-50 text-yellow-700"
                  : operationLock?.isExpired
                    ? "bg-red-50 text-red-700"
                    : "bg-green-50 text-green-700"
              }`}
            >
              {operationLock
                ? operationLock.isExpired
                  ? "Expired Lock"
                  : "Locked"
                : "Available"}
            </span>
          </div>

          {operationLock ? (
            <dl className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4">
                <dt className="text-sm text-gray-500">Operation</dt>
                <dd className="mt-1 font-semibold text-gray-900">
                  {operationLock.operationType}
                </dd>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <dt className="text-sm text-gray-500">Owner</dt>
                <dd className="mt-1 break-all font-semibold text-gray-900">
                  {operationLock.lockOwner ?? "-"}
                </dd>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <dt className="text-sm text-gray-500">Locked At</dt>
                <dd className="mt-1 font-semibold text-gray-900">
                  {operationLock.lockedAt.toLocaleString()}
                </dd>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <dt className="text-sm text-gray-500">Expires At</dt>
                <dd className="mt-1 font-semibold text-gray-900">
                  {operationLock.expiresAt.toLocaleString()}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-gray-600">
              No production operation is currently running.
            </p>
          )}

          {operationLock && (
            <div className="mt-5">
              <ForceReleaseOperationLockButton />
            </div>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Production Deployments
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Latest deploy attempts, commit SHA, health checks, and failure stage.
            </p>
          </div>

          {deployments.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No production deployments recorded yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Commit</th>
                    <th className="px-6 py-3">Branch</th>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Completed</th>
                    <th className="px-6 py-3">Failure</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {deployments.map((deployment) => (
                    <tr key={deployment.id}>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            deployment.status === "SUCCEEDED"
                              ? "bg-green-50 text-green-700"
                              : deployment.status === "FAILED"
                                ? "bg-red-50 text-red-700"
                                : "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {deployment.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          <Link
                            href={`/dashboard/system/deployments/${deployment.id}`}
                            className="font-medium text-gray-900 hover:underline"
                          >
                            {deployment.commitSha ?? "-"}
                          </Link>
                        </div>
                        {deployment.commitMessage && (
                          <div className="max-w-xs truncate text-xs text-gray-500">
                            {deployment.commitMessage}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">{deployment.branch ?? "-"}</td>

                      <td className="px-6 py-4">
                        {deployment.startedAt.toLocaleString()}
                      </td>

                      <td className="px-6 py-4">
                        {deployment.completedAt
                          ? deployment.completedAt.toLocaleString()
                          : "-"}
                      </td>

                      <td className="px-6 py-4">
                        {deployment.errorStage ? (
                          <div>
                            <div className="font-medium text-red-700">
                              {deployment.errorStage}
                            </div>
                            <div className="max-w-md truncate text-xs text-gray-500">
                              {deployment.errorMessage}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Production Rollbacks
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Latest rollback attempts, target refs, health checks, and failure stages.
            </p>
          </div>

          {rollbacks.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No production rollbacks recorded yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">From</th>
                    <th className="px-6 py-3">To</th>
                    <th className="px-6 py-3">Target Ref</th>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Failure</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {rollbacks.map((rollback) => (
                    <tr key={rollback.id}>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            rollback.status === "SUCCEEDED"
                              ? "bg-green-50 text-green-700"
                              : rollback.status === "FAILED"
                                ? "bg-red-50 text-red-700"
                                : "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {rollback.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900">
                        {rollback.fromCommitSha ?? "-"}
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900">
                        {rollback.toCommitSha ?? "-"}
                      </td>

                      <td className="px-6 py-4">{rollback.toRef ?? "-"}</td>

                      <td className="px-6 py-4">
                        {rollback.startedAt.toLocaleString()}
                      </td>

                      <td className="px-6 py-4">
                        {rollback.errorStage ? (
                          <div>
                            <div className="font-medium text-red-700">
                              {rollback.errorStage}
                            </div>
                            <div className="max-w-md truncate text-xs text-gray-500">
                              {rollback.errorMessage}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Database Restore Runs
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Latest production database restore attempts and failure stages.
            </p>
          </div>

          {restoreRuns.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              No database restore runs recorded yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Backup File</th>
                    <th className="px-6 py-3">Checksum</th>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Completed</th>
                    <th className="px-6 py-3">Failure</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {restoreRuns.map((restoreRun) => (
                    <tr key={restoreRun.id}>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            restoreRun.status === "SUCCEEDED"
                              ? "bg-green-50 text-green-700"
                              : restoreRun.status === "FAILED"
                                ? "bg-red-50 text-red-700"
                                : "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {restoreRun.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {restoreRun.sourceFileName ?? "-"}
                        </div>
                        {restoreRun.sourceFilePath && (
                          <div className="max-w-xs truncate text-xs text-gray-500">
                            {restoreRun.sourceFilePath}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-mono text-xs">
                          {restoreRun.checksumSha256
                            ? restoreRun.checksumSha256.slice(0, 16)
                            : "-"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        {restoreRun.startedAt.toLocaleString()}
                      </td>

                      <td className="px-6 py-4">
                        {restoreRun.completedAt
                          ? restoreRun.completedAt.toLocaleString()
                          : "-"}
                      </td>

                      <td className="px-6 py-4">
                        {restoreRun.errorStage ? (
                          <div>
                            <div className="font-medium text-red-700">
                              {restoreRun.errorStage}
                            </div>
                            <div className="max-w-md truncate text-xs text-gray-500">
                              {restoreRun.errorMessage}
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Overall Status
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Background infrastructure status for this application.
              </p>
            </div>

            <span
              className={`rounded-full px-4 py-2 text-sm font-medium ${statusClass(
                health.isHealthy,
              )}`}
            >
              {health.isHealthy ? "Healthy" : "Needs Attention"}
            </span>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Health Check Endpoints
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            Use the public endpoint for uptime monitoring and the
            token-protected deep endpoint for internal diagnostics.
          </p>

          <div className="mt-4 grid gap-3">
            <code className="block rounded-lg bg-blue-950 px-4 py-3 text-sm text-white">
              GET /api/health
            </code>

            <code className="block rounded-lg bg-blue-950 px-4 py-3 text-sm text-white">
              GET /api/health/deep with x-healthcheck-token
            </code>
          </div>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Database</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {health.database.ok ? "Connected" : "Down"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                  health.database.ok,
                )}`}
              >
                {health.database.ok ? "OK" : "ERROR"}
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Latency:{" "}
              {health.database.latencyMs !== null
                ? `${health.database.latencyMs}ms`
                : "-"}
            </p>

            {health.database.error ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {health.database.error}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Redis</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {health.redis.ok ? "Connected" : "Down"}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                  health.redis.ok,
                )}`}
              >
                {health.redis.ok ? "OK" : "ERROR"}
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              Latency:{" "}
              {health.redis.latencyMs !== null
                ? `${health.redis.latencyMs}ms`
                : "-"}
            </p>

            {health.redis.error ? (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {health.redis.error}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Database Backups
              </h2>

              <p className="mt-1 text-sm text-gray-600">
                Scheduled PostgreSQL backup status and retention.
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <RunDatabaseBackupButton />
              <VerifyLatestBackupButton />

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  health.databaseBackups.isHealthy
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {health.databaseBackups.enabled
                  ? health.databaseBackups.isHealthy
                    ? "Healthy"
                    : "Needs Attention"
                  : "Disabled"}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-6">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Enabled</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.enabled ? "Yes" : "No"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Latest Backup</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackup?.status ?? "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Age</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackupAgeHours !== null
                  ? `${health.databaseBackups.latestBackupAgeHours}h`
                  : "-"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Retention</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.retentionDays} days
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Remote Storage</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.remoteStorageEnabled
                  ? "Enabled"
                  : "Disabled"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Remote Copy</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackupHasRemoteCopy
                  ? "Available"
                : "Missing"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Verification</p>
              <p className="mt-1 font-semibold text-gray-900">
                {health.databaseBackups.latestBackup?.verificationStatus ?? "-"}
              </p>
            </div>
          </div>

          {health.databaseBackups.latestBackup?.fileName && (
            <p className="mt-4 break-all text-xs text-gray-500">
              Latest file: {health.databaseBackups.latestBackup.fileName}
            </p>
          )}

          {health.databaseBackups.latestBackup?.remoteKey && (
            <p className="mt-2 break-all text-xs text-gray-500">
              Remote key: {health.databaseBackups.latestBackup.remoteKey}
            </p>
          )}

          {health.databaseBackups.latestBackup?.remoteUploadError && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Remote upload error:{" "}
              {health.databaseBackups.latestBackup.remoteUploadError}
            </p>
          )}

          {health.databaseBackups.latestBackup?.verificationError && (
            <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              Verification error:{" "}
              {health.databaseBackups.latestBackup.verificationError}
            </p>
          )}

          {health.databaseBackups.latestBackup?.verifiedAt && (
            <p className="mt-2 text-xs text-gray-500">
              Verified at:{" "}
              {health.databaseBackups.latestBackup.verifiedAt.toLocaleString()}
            </p>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Queues</h2>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-3">Queue</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Waiting</th>
                  <th className="px-6 py-3">Active</th>
                  <th className="px-6 py-3">Delayed</th>
                  <th className="px-6 py-3">Failed</th>
                  <th className="px-6 py-3">Completed</th>
                  <th className="px-6 py-3">Error</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {health.queues.map((queue) => (
                  <tr key={queue.name}>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {queue.name}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${queueStatusClass(
                          queue.isHealthy,
                        )}`}
                      >
                        {queue.paused
                          ? "Paused"
                          : queue.isHealthy
                            ? "Healthy"
                            : "Attention"}
                      </span>
                    </td>

                    <td className="px-6 py-4">{queue.waiting}</td>
                    <td className="px-6 py-4">{queue.active}</td>
                    <td className="px-6 py-4">{queue.delayed}</td>
                    <td className="px-6 py-4">{queue.failed}</td>
                    <td className="px-6 py-4">{queue.completed}</td>
                    <td className="max-w-md px-6 py-4 text-gray-600">
                      {queue.error ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Production Process Manager
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            Use PM2 or an equivalent process manager to keep the web server and
            workers running. Required workers that are not started will appear
            as stale or missing here.
          </p>

          <code className="mt-4 block rounded-lg bg-blue-950 px-4 py-3 text-sm text-white">
            npm run pm2:start
          </code>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Worker Heartbeats
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            A worker is considered stale if it has not sent a heartbeat for
            more than two minutes. Make sure production process managers run
            all required workers.
          </p>
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Workers</h2>
          </div>

          {health.workerHeartbeats.workers.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No worker heartbeats found yet. Start your workers to see them
              here.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Worker</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Hostname</th>
                    <th className="px-6 py-3">PID</th>
                    <th className="px-6 py-3">Last Heartbeat</th>
                    <th className="px-6 py-3">Error</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {health.workerHeartbeats.workers.map((worker) => (
                    <tr key={worker.id}>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {worker.workerName}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            worker.isHealthy
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {worker.isStale ? "STALE" : worker.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">{worker.hostname ?? "-"}</td>
                      <td className="px-6 py-4">{worker.processId ?? "-"}</td>

                      <td className="px-6 py-4">
                        {worker.lastHeartbeatAt.toLocaleString()}
                      </td>

                      <td className="max-w-md px-6 py-4 text-gray-600">
                        {worker.lastError ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mb-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 font-medium">Security Events</h2>
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${
              health.unresolvedHighEventsCount === 0
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}>
              {health.unresolvedHighEventsCount === 0 ? "All Resolved" : `${health.unresolvedHighEventsCount} Open High/Critical`}
            </span>
          </div>

          {securityEvents.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">No security events found.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3 font-medium text-gray-900">Created</th>
                    <th className="px-6 py-3 font-medium text-gray-900">Severity</th>
                    <th className="px-6 py-3 font-medium text-gray-900">Summary</th>
                    <th className="px-6 py-3 font-medium text-gray-900">Type</th>
                    <th className="px-6 py-3 font-medium text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {securityEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="px-6 py-4 text-gray-600">
                        {event.createdAt.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          event.severity === "CRITICAL" || event.severity === "HIGH"
                            ? "bg-red-50 text-red-700"
                            : event.severity === "MEDIUM"
                              ? "bg-yellow-50 text-yellow-700"
                              : "bg-green-50 text-green-700"
                        }`}>
                          {event.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/system/security-events/${event.id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {event.summary}
                        </Link>
                        {event.resolvedAt && (
                          <div className="mt-1 text-xs text-green-700">
                            Resolved {event.resolvedAt.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{event.type}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          event.resolvedAt
                            ? "bg-green-50 text-green-700"
                            : "bg-yellow-50 text-yellow-700"
                        }`}>
                          {event.resolvedAt ? "Resolved" : "Open"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Recent Maintenance Runs
            </h2>
          </div>

          {health.recentJobs.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No maintenance jobs found.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Started</th>
                    <th className="px-6 py-3">Job</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Checked</th>
                    <th className="px-6 py-3">Recovered</th>
                    <th className="px-6 py-3">Error</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {health.recentJobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-6 py-4">
                        {job.startedAt.toLocaleString()}
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900">
                        {job.jobName}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            job.status === "COMPLETED"
                              ? "bg-green-50 text-green-700"
                              : job.status === "FAILED"
                                ? "bg-red-50 text-red-700"
                                : "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {job.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">{job.checkedCount}</td>
                      <td className="px-6 py-4">{job.recoveredCount}</td>

                      <td className="max-w-md px-6 py-4 text-gray-600">
                        {job.errorMessage ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
