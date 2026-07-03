import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { runAutomationMonitoringChecks } from "@/server/services/automation-monitoring.service";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

export async function POST() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    await assertAutomationApiPermission({
      companyId: context.membership.companyId,
      permission: "automation.monitoring.run_checks",
      userId: context.user.id,
    });

    const result = await runAutomationMonitoringChecks(
      context.membership.companyId,
    );

    return NextResponse.json(result);
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_MONITORING_RUN_CHECKS_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to run automation monitoring checks" },
      { status: 500 },
    );
  }
}
