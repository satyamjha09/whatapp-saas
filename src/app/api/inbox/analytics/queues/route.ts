import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { getInboxQueueAnalytics } from "@/server/services/inbox-analytics.service";

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

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

    await assertRoutePermission({ request, workspace: context });

    const url = new URL(request.url);
    const queues = await getInboxQueueAnalytics(context.membership.companyId, {
      agentId: url.searchParams.get("agentId"),
      queueId: url.searchParams.get("queueId"),
      dateFrom: parseDate(url.searchParams.get("from")),
      dateTo: parseDate(url.searchParams.get("to")),
    });

    return NextResponse.json({ queues });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }
}
