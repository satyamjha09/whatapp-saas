import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { assertRoutePermission, createRoutePermissionErrorResponse } from "@/server/auth/route-permission-guard";
import {
  getContactImportDashboard,
  previewContactImport,
  ContactImportError,
} from "@/server/services/contact-import.service";

const PreviewSchema = z.object({
  fileName: z.string().optional().nullable(),
  csvText: z.string().min(1),
  duplicateStrategy: z.enum(["UPDATE_EXISTING", "SKIP_EXISTING"]).default("UPDATE_EXISTING"),
  fieldMapping: z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    city: z.string().optional(),
    companyName: z.string().optional(),
  }),
  consentMapping: z.object({
    marketingConsentStatus: z.string().optional(),
    marketingConsentProof: z.string().optional(),
    marketingConsentSource: z.string().optional(),
  }).default({}),
});

export async function GET(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_VIEW",
    });

    const dashboard = await getContactImportDashboard(workspace.membership.companyId);

    return NextResponse.json({
      ok: true,
      dashboard,
    });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireAuthenticatedWorkspace({ request });
    await assertRoutePermission({
      request,
      workspace,
      permission: "CONTACT_UPDATE",
    });

    const body = PreviewSchema.parse(await request.json());

    const job = await previewContactImport({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      fileName: body.fileName,
      csvText: body.csvText,
      duplicateStrategy: body.duplicateStrategy,
      fieldMapping: body.fieldMapping,
      consentMapping: body.consentMapping,
    });

    return NextResponse.json({
      ok: true,
      job,
    });
  } catch (error) {
    if (error instanceof ContactImportError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CONTACT_IMPORT_ERROR",
          message: error.message,
        },
        {
          status: 400,
        },
      );
    }

    return createRoutePermissionErrorResponse(error);
  }
}
