import { NextResponse } from "next/server";
import {
  AutomationPermissionDeniedError,
  requireAutomationPermission,
  type AutomationPermissionName,
} from "@/server/services/automation-permission.service";

export async function assertAutomationApiPermission({
  companyId,
  permission,
  userId,
}: {
  companyId: string;
  permission: AutomationPermissionName;
  userId: string;
}) {
  await requireAutomationPermission(companyId, userId, permission);
}

export function createAutomationPermissionErrorResponse(error: unknown) {
  if (error instanceof AutomationPermissionDeniedError) {
    return NextResponse.json({ message: error.message }, { status: 403 });
  }

  return null;
}
