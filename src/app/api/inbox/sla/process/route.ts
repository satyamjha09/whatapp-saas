import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { processInboxSlaBreaches } from "@/server/services/inbox-sla-escalation.service";

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

    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can process SLA breaches" },
        { status: 403 },
      );
    }

    const result = await processInboxSlaBreaches({
      companyId: context.membership.companyId,
      limit: 100,
    });

    return NextResponse.json({
      message: "SLA breach processing completed",
      result,
    });
  } catch (error) {
    console.error("PROCESS_INBOX_SLA_BREACHES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to process SLA breaches" },
      { status: 500 },
    );
  }
}
