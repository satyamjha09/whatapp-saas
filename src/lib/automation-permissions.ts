import type { CompanyRole } from "@/generated/prisma/client";

export type AutomationPermissionName =
  | "automation.flow.view"
  | "automation.flow.create"
  | "automation.flow.edit"
  | "automation.flow.delete"
  | "automation.flow.archive"
  | "automation.flow.test"
  | "automation.flow.publish"
  | "automation.flow.request_publish"
  | "automation.flow.approve_publish"
  | "automation.flow.reject_publish"
  | "automation.flow.rollback"
  | "automation.flow.pause"
  | "automation.flow.resume"
  | "automation.analytics.view"
  | "automation.execution.view"
  | "automation.template_library.use";

export function hasAutomationPermission(
  role: CompanyRole | string,
  permission: AutomationPermissionName,
  approvalRequired = false
): boolean {
  const normalizedRole = role.toUpperCase();

  // OWNER and ADMIN can do everything
  if (normalizedRole === "OWNER" || normalizedRole === "ADMIN") {
    return true;
  }

  // AUTOMATION_MANAGER role (or standard MEMBER acting as Manager)
  if (normalizedRole === "AUTOMATION_MANAGER" || normalizedRole === "MEMBER") {
    switch (permission) {
      case "automation.flow.view":
      case "automation.flow.create":
      case "automation.flow.edit":
      case "automation.flow.test":
      case "automation.flow.request_publish":
      case "automation.flow.rollback":
      case "automation.flow.pause":
      case "automation.flow.resume":
      case "automation.analytics.view":
      case "automation.execution.view":
      case "automation.template_library.use":
        return true;

      case "automation.flow.publish":
        // If approval is required by company setting, Manager cannot publish directly
        return !approvalRequired;

      case "automation.flow.approve_publish":
      case "automation.flow.reject_publish":
      case "automation.flow.delete":
      case "automation.flow.archive":
        return false;

      default:
        return false;
    }
  }

  // AGENT role
  if (normalizedRole === "AGENT") {
    switch (permission) {
      case "automation.flow.view":
      case "automation.analytics.view":
      case "automation.execution.view":
        return true;
      default:
        return false;
    }
  }

  // VIEWER role
  if (normalizedRole === "VIEWER") {
    switch (permission) {
      case "automation.flow.view":
      case "automation.analytics.view":
        return true;
      default:
        return false;
    }
  }

  return false;
}

export function getUserAutomationPermissions(
  role: CompanyRole | string,
  approvalRequired = false
): Record<AutomationPermissionName, boolean> {
  const permissions: AutomationPermissionName[] = [
    "automation.flow.view",
    "automation.flow.create",
    "automation.flow.edit",
    "automation.flow.delete",
    "automation.flow.archive",
    "automation.flow.test",
    "automation.flow.publish",
    "automation.flow.request_publish",
    "automation.flow.approve_publish",
    "automation.flow.reject_publish",
    "automation.flow.rollback",
    "automation.flow.pause",
    "automation.flow.resume",
    "automation.analytics.view",
    "automation.execution.view",
    "automation.template_library.use",
  ];

  const result = {} as Record<AutomationPermissionName, boolean>;
  permissions.forEach((perm) => {
    result[perm] = hasAutomationPermission(role, perm, approvalRequired);
  });

  return result;
}
