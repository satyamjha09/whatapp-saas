import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAutomationUsageSummary } from "@/server/services/automation-usage.service";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 }
      );
    }

    const summary = await getAutomationUsageSummary(context.membership.companyId);
    return NextResponse.json(summary);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET_AUTOMATION_USAGE_ERROR:", err);
    return NextResponse.json(
      { message: "Unable to retrieve automation usage summary." },
      { status: 500 }
    );
  }
}
