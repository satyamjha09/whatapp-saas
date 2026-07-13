import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listTallyOrderSyncRunsForCompany } from "@/server/services/tally-order-sync.service";
import { listTallySyncRunsQuerySchema } from "@/server/validators/tally-order-sync.validator";

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

    const url = new URL(request.url);
    const query = listTallySyncRunsQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      tallyCompanyId: url.searchParams.get("tallyCompanyId") ?? undefined,
    });

    return NextResponse.json(
      await listTallyOrderSyncRunsForCompany(context.membership.companyId, query),
    );
  } catch (error) {
    console.error("LIST_TALLY_SYNC_RUNS_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to list Tally sync runs",
      },
      { status: 400 },
    );
  }
}
