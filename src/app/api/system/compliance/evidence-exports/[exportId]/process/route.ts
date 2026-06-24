import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getComplianceEvidenceExport,
  processComplianceEvidenceExport,
} from "@/server/services/compliance-evidence.service";

type RouteContext = {
  params: Promise<{
    exportId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { exportId } = await context.params;
  const existing = await getComplianceEvidenceExport({
    companyId: workspace.membership.companyId,
    exportId,
  });

  if (!existing) {
    return NextResponse.json(
      {
        ok: false,
        message: "Compliance evidence export not found",
      },
      { status: 404 },
    );
  }

  try {
    const result = await processComplianceEvidenceExport({
      exportId,
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "compliance_evidence.export_processed",
      entityType: "ComplianceEvidenceExport",
      entityId: exportId,
      metadata: {
        status: result.status,
        type: result.type,
      },
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to process compliance evidence export",
      },
      { status: 500 },
    );
  }
}
