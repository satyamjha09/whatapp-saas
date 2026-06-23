import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getOperationsHealth } from "@/server/services/operations-health.service";

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

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Only owners and admins can run health checks" },
        { status: 403 },
      );
    }

    const health = await getOperationsHealth();

    return NextResponse.json({
      message: "Health check completed",
      health,
    });
  } catch (error) {
    console.error("SYSTEM_HEALTH_CHECK_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to run health check" },
      { status: 500 },
    );
  }
}
