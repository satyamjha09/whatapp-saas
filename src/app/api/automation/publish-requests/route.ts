import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listPublishRequests } from "@/server/services/automation-publish-approval.service";
import { ListPublishRequestsQuerySchema } from "@/server/validators/automation-publish-approval.validator";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const rawParams = {
      status: searchParams.get("status") || undefined,
      flowId: searchParams.get("flowId") || undefined,
      page: searchParams.get("page") || undefined,
      pageSize: searchParams.get("pageSize") || undefined,
    };

    const validatedInput = ListPublishRequestsQuerySchema.parse(rawParams);

    const result = await listPublishRequests(
      context.membership.companyId,
      context.user.id,
      validatedInput
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("LIST_PUBLISH_REQUESTS_ERROR:", err);

    if (err.name === "AutomationPermissionDeniedError") {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: err.message || "Unable to list publish approval requests." },
      { status: 500 }
    );
  }
}
