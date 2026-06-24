import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createComplianceEvidenceExport,
  listComplianceEvidenceExports,
} from "@/server/services/compliance-evidence.service";

const CreateEvidenceExportSchema = z.object({
  type: z.enum([
    "COMPANY_COMPLIANCE",
    "CONTACT_COMPLIANCE",
    "PRIVACY_COMPLIANCE",
    "SECURITY_COMPLIANCE",
    "RETENTION_COMPLIANCE",
  ]),
  contactId: z.string().trim().optional().nullable(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
});

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const exports = await listComplianceEvidenceExports({
    companyId: workspace.membership.companyId,
  });

  return NextResponse.json({
    ok: true,
    exports,
  });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const validation = CreateEvidenceExportSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid evidence export request",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  try {
    const evidenceExport = await createComplianceEvidenceExport({
      companyId: workspace.membership.companyId,
      requestedByUserId: workspace.user.id,
      type: validation.data.type,
      contactId: validation.data.contactId,
      dateFrom: new Date(validation.data.dateFrom),
      dateTo: new Date(validation.data.dateTo),
    });

    await createAuditLog({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      action: "compliance_evidence.export_created",
      entityType: "ComplianceEvidenceExport",
      entityId: evidenceExport.id,
      metadata: {
        type: evidenceExport.type,
        contactId: evidenceExport.contactId,
        dateFrom: evidenceExport.dateFrom.toISOString(),
        dateTo: evidenceExport.dateTo.toISOString(),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        export: evidenceExport,
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Unable to create compliance evidence export",
      },
      { status: 400 },
    );
  }
}
