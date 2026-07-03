import { prisma } from "@/lib/prisma";
import type { RbacPermission } from "@/generated/prisma/client";
import {
  getUserPermissions,
  isRbacV2Enabled,
} from "@/server/services/rbac-v2.service";
import {
  hasAutomationPermission,
  getUserAutomationPermissions,
  type AutomationPermissionName,
} from "@/lib/automation-permissions";

export {
  hasAutomationPermission,
  getUserAutomationPermissions,
  type AutomationPermissionName,
};

export class AutomationPermissionDeniedError extends Error {
  constructor(permission: string) {
    super(`Permission denied: You do not have permission "${permission}".`);
    this.name = "AutomationPermissionDeniedError";
  }
}

export const AUTOMATION_RBAC_PERMISSION_MAP: Record<AutomationPermissionName, RbacPermission> = {
  "automation.flow.view": "AUTOMATION_FLOW_VIEW",
  "automation.flow.create": "AUTOMATION_FLOW_CREATE",
  "automation.flow.edit": "AUTOMATION_FLOW_EDIT",
  "automation.flow.delete": "AUTOMATION_FLOW_DELETE",
  "automation.flow.archive": "AUTOMATION_FLOW_ARCHIVE",
  "automation.flow.test": "AUTOMATION_FLOW_TEST",
  "automation.flow.publish": "AUTOMATION_FLOW_PUBLISH",
  "automation.flow.request_publish": "AUTOMATION_FLOW_REQUEST_PUBLISH",
  "automation.flow.approve_publish": "AUTOMATION_FLOW_APPROVE_PUBLISH",
  "automation.flow.reject_publish": "AUTOMATION_FLOW_REJECT_PUBLISH",
  "automation.flow.rollback": "AUTOMATION_FLOW_ROLLBACK",
  "automation.flow.pause": "AUTOMATION_FLOW_PAUSE",
  "automation.flow.resume": "AUTOMATION_FLOW_RESUME",
  "automation.analytics.view": "AUTOMATION_ANALYTICS_VIEW",
  "automation.execution.view": "AUTOMATION_EXECUTION_VIEW",
  "automation.template_library.use": "AUTOMATION_TEMPLATE_LIBRARY_USE",
  "automation.monitoring.view": "AUTOMATION_MONITORING_VIEW",
  "automation.alert.view": "AUTOMATION_ALERT_VIEW",
  "automation.alert.manage": "AUTOMATION_ALERT_MANAGE",
  "automation.monitoring.run_checks": "AUTOMATION_MONITORING_RUN_CHECKS",
};

export async function checkUserAutomationPermission(
  companyId: string,
  userId: string,
  permission: AutomationPermissionName
): Promise<boolean> {
  const companyUser = await prisma.companyUser.findFirst({
    where: { companyId, userId },
    include: { company: true },
  });

  if (!companyUser) {
    return false;
  }

  if (companyUser.role === "OWNER" || companyUser.role === "ADMIN") {
    return true;
  }

  const approvalRequired = companyUser.company.automationPublishApprovalRequired;

  if (isRbacV2Enabled()) {
    const rbacPermissions = await getUserPermissions({ companyId, userId });
    const mappedPermission = AUTOMATION_RBAC_PERMISSION_MAP[permission];
    if (!rbacPermissions.has(mappedPermission)) {
      return false;
    }

    return !(
      permission === "automation.flow.publish" &&
      approvalRequired &&
      !rbacPermissions.has("AUTOMATION_FLOW_APPROVE_PUBLISH")
    );
  }

  return hasAutomationPermission(companyUser.role, permission, approvalRequired);
}

export async function requireAutomationPermission(
  companyId: string,
  userId: string,
  permission: AutomationPermissionName
): Promise<void> {
  const allowed = await checkUserAutomationPermission(companyId, userId, permission);
  if (!allowed) {
    throw new AutomationPermissionDeniedError(permission);
  }
}
