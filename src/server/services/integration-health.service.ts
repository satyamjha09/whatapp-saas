import { prisma } from "@/lib/prisma";

export type IntegrationIssue = {
  integrationType: string;
  flowId?: string;
  flowName?: string;
  nodeId?: string;
  nodeType?: string;
  failedCount: number;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  message: string;
  fingerprint: string;
  sampleError?: string | null;
};

const AUTH_ERROR_PATTERN = /(oauth|auth|unauthori[sz]ed|invalid token|expired|permission|scope)/i;
const TIMEOUT_ERROR_PATTERN = /(timeout|timed out|rate limit|429)/i;

function classifyIntegration(nodeType: string, errorMessage?: string | null) {
  const normalizedNodeType = nodeType.toUpperCase();
  const normalizedError = errorMessage ?? "";

  if (normalizedNodeType.includes("GOOGLE")) {
    return {
      integrationType: "GOOGLE_SHEETS",
      title: AUTH_ERROR_PATTERN.test(normalizedError)
        ? "Google Sheet OAuth expired"
        : "Google Sheet automation node is failing",
    };
  }

  if (normalizedNodeType.includes("TALLY")) {
    return {
      integrationType: "TALLY",
      title: "Tally automation node is failing",
    };
  }

  if (normalizedNodeType.includes("PAYMENT") || normalizedNodeType.includes("CASHFREE")) {
    return {
      integrationType: "CASHFREE",
      title: "Cashfree payment link node is failing",
    };
  }

  if (normalizedNodeType.includes("AI")) {
    return {
      integrationType: "AI",
      title: TIMEOUT_ERROR_PATTERN.test(normalizedError)
        ? "AI node timed out"
        : "AI node is failing",
    };
  }

  if (normalizedNodeType.includes("WEBHOOK") || normalizedNodeType.includes("API")) {
    return {
      integrationType: "WEBHOOK_API",
      title: "Webhook/API node is failing",
    };
  }

  return null;
}

export async function getRecentIntegrationFailures({
  companyId,
  since,
}: {
  companyId?: string;
  since: Date;
}) {
  const failedSteps = await prisma.automationExecutionStep.findMany({
    where: {
      ...(companyId ? { companyId } : {}),
      status: "FAILED",
      startedAt: { gte: since },
      nodeType: {
        in: [
          "TALLY_LOOKUP",
          "GOOGLE_SHEET_APPEND_ROW",
          "GOOGLE_SHEET_UPDATE_ROW",
          "PAYMENT_LINK",
          "CASHFREE_PAYMENT_LINK",
          "AI_REPLY",
          "WEBHOOK",
          "API_CALL",
        ],
      },
    },
    include: {
      execution: {
        include: {
          flow: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { startedAt: "desc" },
    take: 1000,
  });

  const grouped = new Map<string, IntegrationIssue>();

  for (const step of failedSteps) {
    const classification = classifyIntegration(step.nodeType, step.errorMessage);
    if (!classification) continue;

    const key = `${step.companyId}:${classification.integrationType}:${step.execution.flowId}:${step.nodeId}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.failedCount += 1;
      continue;
    }

    grouped.set(key, {
      integrationType: classification.integrationType,
      flowId: step.execution.flowId,
      flowName: step.execution.flow.name,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      failedCount: 1,
      severity:
        classification.integrationType === "GOOGLE_SHEETS" &&
        AUTH_ERROR_PATTERN.test(step.errorMessage ?? "")
          ? "CRITICAL"
          : "WARNING",
      title: classification.title,
      message:
        step.errorMessage ??
        `${classification.integrationType} node has repeated failures.`,
      fingerprint: key,
      sampleError: step.errorMessage,
    });
  }

  return [...grouped.values()].filter((issue) => {
    if (issue.integrationType === "GOOGLE_SHEETS" && issue.severity === "CRITICAL") {
      return true;
    }

    return issue.failedCount >= 3;
  });
}
