import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listTallyMappingsForCompany } from "@/server/services/tally-order-mapping.service";
import { listTallyMappingsQuerySchema } from "@/server/validators/tally-order-sync.validator";

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
    const query = listTallyMappingsQuerySchema.parse({
      onlyUnmapped: url.searchParams.get("onlyUnmapped") ?? undefined,
      tallyCompanyId: url.searchParams.get("tallyCompanyId") ?? undefined,
    });

    return NextResponse.json(
      await listTallyMappingsForCompany(context.membership.companyId, query),
    );
  } catch (error) {
    console.error("LIST_TALLY_MAPPINGS_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to list Tally mappings",
      },
      { status: 400 },
    );
  }
}
