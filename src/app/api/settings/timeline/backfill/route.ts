import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { runTimelineBackfill } from "@/server/services/timeline-backfill.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const result = await runTimelineBackfill({
      actorUserId: workspace.user.id,
      companyId: workspace.membership.companyId,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Timeline backfill failed.",
      },
      { status: 400 },
    );
  }
}
