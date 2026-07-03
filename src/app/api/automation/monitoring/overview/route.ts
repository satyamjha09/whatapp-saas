import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getMonitoringOverview } from "@/server/services/automation-monitoring.service";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";
import { monitoringOverviewQuerySchema } from "@/server/validators/automation-alert.validator";

export async function GET(request: Request) {
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
      permission: "automation.monitoring.view",
      userId: context.user.id,
    });

    const url = new URL(request.url);
    const validation = monitoringOverviewQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.flatten().fieldErrors, message: "Invalid filters" },
        { status: 400 },
      );
    }

    const overview = await getMonitoringOverview(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json(overview);
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_MONITORING_OVERVIEW_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to load automation monitoring overview" },
      { status: 500 },
    );
  }
}
