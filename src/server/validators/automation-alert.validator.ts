import { z } from "zod";

export const automationAlertStatusSchema = z.enum([
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "MUTED",
]);

export const automationAlertSeveritySchema = z.enum([
  "INFO",
  "WARNING",
  "CRITICAL",
]);

export const automationAlertTypeSchema = z.enum([
  "AUTOMATION_EXECUTION_FAILURE_SPIKE",
  "AUTOMATION_NODE_FAILURE_SPIKE",
  "AUTOMATION_RUNTIME_QUEUE_STUCK",
  "AUTOMATION_RUNTIME_QUEUE_FAILED",
  "WEBHOOK_QUEUE_FAILED",
  "DEVELOPER_WEBHOOK_QUEUE_FAILED",
  "MESSAGE_SEND_FAILURE_SPIKE",
  "TALLY_CONNECTION_FAILED",
  "GOOGLE_SHEET_AUTH_EXPIRED",
  "CASHFREE_PAYMENT_LINK_FAILED",
  "CASHFREE_WEBHOOK_DELAYED",
  "AI_NODE_FAILED",
  "WEBHOOK_NODE_FAILED",
  "LOOP_DETECTED",
  "DUPLICATE_EXECUTION_BLOCKED",
  "INSUFFICIENT_WALLET_SPIKE",
  "PLAN_LIMIT_REACHED",
  "FLOW_BLOCKED_BY_PLAN",
  "WAITING_SESSION_TIMEOUT_SPIKE",
  "REDIS_UNHEALTHY",
  "WORKER_UNHEALTHY",
  "CUSTOM",
]);

export const monitoringOverviewQuerySchema = z.object({
  range: z.enum(["1h", "24h", "7d", "30d"]).default("24h"),
});

export const automationAlertListQuerySchema = z.object({
  status: automationAlertStatusSchema.optional(),
  severity: automationAlertSeveritySchema.optional(),
  type: automationAlertTypeSchema.optional(),
  flowId: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AutomationAlertFilters = z.infer<
  typeof automationAlertListQuerySchema
>;
export type AutomationAlertListQuery = z.infer<
  typeof automationAlertListQuerySchema
>;
export type MonitoringOverviewQuery = z.infer<
  typeof monitoringOverviewQuerySchema
>;
