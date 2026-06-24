import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { runDataRetentionPolicies } from "@/server/services/data-retention.service";
import { createAuditLog } from "@/server/services/audit.service";

const RunRetentionSchema = z.object({
  dryRun: z.boolean().optional(),
});

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const body = RunRetentionSchema.parse(await request.json().catch(() => ({})));
  const result = await runDataRetentionPolicies({
    forceDryRun: body.dryRun,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "data_retention.run",
    entityType: "DataRetentionRun",
    entityId: "id" in result ? result.id : undefined,
    metadata: result,
  });

  return NextResponse.json({
    ok: true,
    result,
  });
}
