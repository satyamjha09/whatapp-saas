import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";
import {
  getContactConsentTimeline,
  recordContactConsent,
} from "@/server/services/contact-consent.service";
import { createAuditLog } from "@/server/services/audit.service";

const ConsentSchema = z.object({
  type: z.enum([
    "WHATSAPP_MARKETING",
    "WHATSAPP_UTILITY",
    "WHATSAPP_SERVICE",
    "DATA_PROCESSING",
  ]),
  status: z.enum(["GRANTED", "REVOKED", "UNKNOWN"]),
  source: z
    .enum([
      "DASHBOARD",
      "IMPORT",
      "PUBLIC_API",
      "WHATSAPP_KEYWORD",
      "PUBLIC_FORM",
      "SYSTEM",
    ])
    .default("DASHBOARD"),
  evidenceText: z.string().max(2000).optional().nullable(),
  evidenceUrl: z.string().url().optional().nullable(),
});

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { contactId } = await context.params;

  try {
    await assertTenantEntityAccess({
      request,
      companyId: workspace.membership.companyId,
      entityType: "Contact",
      entityId: contactId,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }

  const events = await getContactConsentTimeline({
    companyId: workspace.membership.companyId,
    contactId,
  });

  return NextResponse.json({
    ok: true,
    events,
  });
}

export async function POST(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const { contactId } = await context.params;

  try {
    await assertTenantEntityAccess({
      request,
      companyId: workspace.membership.companyId,
      entityType: "Contact",
      entityId: contactId,
    });
  } catch (error) {
    return createTenantErrorResponse(error);
  }

  const validation = ConsentSchema.safeParse(await request.json());

  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid consent event",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const body = validation.data;
  const event = await recordContactConsent({
    companyId: workspace.membership.companyId,
    contactId,
    actorUserId: workspace.user.id,
    type: body.type,
    status: body.status,
    source: body.source,
    evidenceText: body.evidenceText,
    evidenceUrl: body.evidenceUrl,
    userAgent: request.headers.get("user-agent"),
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "contact.consent_recorded",
    entityType: "Contact",
    entityId: contactId,
    metadata: {
      type: body.type,
      status: body.status,
      source: body.source,
      consentEventId: event?.id,
    },
  });

  return NextResponse.json({
    ok: true,
    event,
  });
}
