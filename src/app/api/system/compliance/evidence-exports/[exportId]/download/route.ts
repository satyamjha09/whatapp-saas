import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import { getComplianceEvidenceExport } from "@/server/services/compliance-evidence.service";

type RouteContext = {
  params: Promise<{
    exportId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { exportId } = await context.params;
  const evidenceExport = await getComplianceEvidenceExport({
    companyId: workspace.membership.companyId,
    exportId,
  });

  if (!evidenceExport?.filePath || !evidenceExport.fileName) {
    return NextResponse.json(
      {
        ok: false,
        message: "Evidence file not available",
      },
      { status: 404 },
    );
  }

  if (evidenceExport.expiresAt && evidenceExport.expiresAt < new Date()) {
    return NextResponse.json(
      {
        ok: false,
        message: "Evidence file has expired",
      },
      { status: 410 },
    );
  }

  const file = await fs.readFile(evidenceExport.filePath);

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "compliance_evidence.export_downloaded",
    entityType: "ComplianceEvidenceExport",
    entityId: exportId,
  });

  return new Response(file, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${path.basename(
        evidenceExport.fileName,
      )}"`,
    },
  });
}
