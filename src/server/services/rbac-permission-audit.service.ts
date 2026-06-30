import fs from "node:fs/promises";
import path from "node:path";
import { RbacPermission } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRequiredPermissionForRoute } from "@/server/auth/rbac-route-permissions";

const API_DIR = path.join(process.cwd(), "src", "app", "api");
const HTTP_METHOD_PATTERN = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
const SENSITIVE_SEGMENTS = [
  "campaign", "send", "cancel", "export", "download", "privacy", "compliance",
  "system", "developer", "api-keys", "webhooks", "whatsapp", "billing", "wallet",
  "team", "roles", "legal-holds", "data-retention",
];

function isEnabled() {
  return process.env.RBAC_PERMISSION_AUDIT_ENABLED !== "false";
}

function shouldFailOnMissingGuards() {
  return process.env.RBAC_PERMISSION_AUDIT_FAIL_ON_MISSING_GUARDS !== "false";
}

function sensitiveOnly() {
  return process.env.RBAC_PERMISSION_AUDIT_SENSITIVE_ONLY !== "false";
}

async function walk(dir: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") files.push(absolute);
  }
  return files;
}

function filePathToApiRoute(filePath: string) {
  const relative = path.relative(API_DIR, filePath).replaceAll("\\", "/");
  return `/api/${relative.replace(/\/route\.tsx?$/, "")}`;
}

function materializeRoute(routePath: string) {
  return routePath.replace(/\[[^\]]+\]/g, "test-id");
}

function routeLooksSensitive(routePath: string) {
  const lower = routePath.toLowerCase();
  return SENSITIVE_SEGMENTS.some((segment) => lower.includes(segment));
}

function hasGuard(content: string) {
  return (
    content.includes("assertRoutePermission") ||
    content.includes("assertUserPermission") ||
    content.includes("authorizeBillingManualReview") ||
    content.includes("requireAuthenticatedWorkspace") ||
    content.includes("requireAdmin({ request") ||
    content.includes("requireMember") ||
    content.includes("requirePlatformAdmin") ||
    content.includes("getCurrentWorkspaceContext") ||
    content.includes("authenticatePublicApiRequest") ||
    content.includes("verifyMetaWebhookSignature") ||
    content.includes("verifyCashfreeWebhookSignature")
  );
}

function exportedMethods(content: string) {
  return [...content.matchAll(HTTP_METHOD_PATTERN)].map((match) => match[1]);
}

export async function runRbacPermissionAudit() {
  if (!isEnabled()) return { skipped: true as const, reason: "RBAC permission audit disabled" };

  const files = await walk(API_DIR);
  const items: Array<{
    routePath: string;
    filePath: string;
    requiredPermission: RbacPermission | null;
    severity: "INFO" | "WARN" | "ERROR";
    message: string;
  }> = [];
  let totalRoutes = 0;
  let guardedRoutes = 0;
  let missingRegistry = 0;
  let missingGuards = 0;

  for (const filePath of files) {
    const routePath = filePathToApiRoute(filePath);
    const content = await fs.readFile(filePath, "utf8");
    const guarded = hasGuard(content);

    for (const method of exportedMethods(content)) {
      const rule = getRequiredPermissionForRoute({
        pathname: materializeRoute(routePath),
        method,
      });
      const sensitive = routeLooksSensitive(routePath);
      if (sensitiveOnly() && !sensitive && !rule) continue;

      totalRoutes += 1;
      if (guarded && rule?.permission) guardedRoutes += 1;

      if (sensitive && !rule) {
        missingRegistry += 1;
        items.push({
          routePath: `${method} ${routePath}`,
          filePath: path.relative(process.cwd(), filePath),
          requiredPermission: null,
          severity: "WARN",
          message: "Sensitive API route has no RBAC registry rule",
        });
      } else if (rule?.permission && !guarded) {
        missingGuards += 1;
        items.push({
          routePath: `${method} ${routePath}`,
          filePath: path.relative(process.cwd(), filePath),
          requiredPermission: rule.permission,
          severity: shouldFailOnMissingGuards() ? "ERROR" : "WARN",
          message: "Registered API route has no visible permission guard",
        });
      }
    }
  }

  const status = items.some((item) => item.severity === "ERROR") ? "FAILED" : "PASSED";
  return prisma.rbacPermissionAuditRun.create({
    data: {
      status,
      totalRoutes,
      guardedRoutes,
      missingRegistry,
      missingGuards,
      items: { create: items },
    },
    include: { items: true },
  });
}

export async function getRbacPermissionAuditHealth() {
  const latestRun = await prisma.rbacPermissionAuditRun.findFirst({
    orderBy: { createdAt: "desc" },
  });
  return {
    enabled: isEnabled(),
    latestRun,
    isHealthy:
      isEnabled() &&
      Boolean(latestRun) &&
      latestRun?.status === "PASSED" &&
      latestRun.missingGuards === 0,
  };
}
