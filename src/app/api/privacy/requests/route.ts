import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  createPrivacyRequest,
  listPrivacyRequests,
} from "@/server/services/privacy-center.service";
import { createAuditLog } from "@/server/services/audit.service";

const CreatePrivacyRequestSchema = z.object({
  contactId: z.string().optional().nullable(),
  type: z.enum(["CONTACT_EXPORT", "CONTACT_DELETE"]),
  requesterEmail: z.string().email().optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
  confirmationText: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const requests = await listPrivacyRequests({
    companyId: workspace.membership.companyId,
  });

  return NextResponse.json({ ok: true, requests });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const body = CreatePrivacyRequestSchema.parse(await request.json());
  const privacyRequest = await createPrivacyRequest({
    companyId: workspace.membership.companyId,
    requestedByUserId: workspace.user.id,
    contactId: body.contactId,
    type: body.type,
    requesterEmail: body.requesterEmail,
    reason: body.reason,
    confirmationText: body.confirmationText,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "privacy.request_created",
    entityType: "PrivacyRequest",
    entityId: privacyRequest.id,
    metadata: {
      type: privacyRequest.type,
      contactId: privacyRequest.contactId,
    },
  });

  return NextResponse.json({ ok: true, privacyRequest });
}
