import { prisma } from "@/lib/prisma";
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

  const approvalRequired = companyUser.company.automationPublishApprovalRequired;
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
