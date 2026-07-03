import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { resolveAlert } from "@/server/services/automation-alert.service";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

type RouteContext = {
  params: Promise<{ alertId: string }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertAutomationApiPermission({
      companyId: context.membership.companyId,
      permission: "automation.alert.manage",
      userId: context.user.id,
    });

    const { alertId } = await params;
    const alert = await resolveAlert(
      context.membership.companyId,
      alertId,
      context.user.id,
    );

    if (!alert) return NextResponse.json({ message: "Alert not found" }, { status: 404 });

    return NextResponse.json({ alert });
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_ALERT_RESOLVE_ERROR:", error);
    return NextResponse.json({ message: "Unable to resolve alert" }, { status: 500 });
  }
}
