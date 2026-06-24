import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  createLegalHold,
  listLegalHolds,
} from "@/server/services/data-retention.service";
import { createAuditLog } from "@/server/services/audit.service";

const CreateLegalHoldSchema = z.object({
  companyId: z.string().optional().nullable(),
  entityType: z.enum(["CONTACT", "COMPANY", "MESSAGE", "PRIVACY_REQUEST", "INCIDENT"]),
  entityId: z.string().min(1),
  reason: z.string().min(1).max(2000),
});

export async function GET(request: Request) {
  try {
    await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const legalHolds = await listLegalHolds();

  return NextResponse.json({
    ok: true,
    legalHolds,
  });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const body = CreateLegalHoldSchema.parse(await request.json());
  const hold = await createLegalHold({
    ...body,
    createdByUserId: workspace.user.id,
  });

  await createAuditLog({
    companyId: workspace.membership.companyId,
    actorUserId: workspace.user.id,
    action: "legal_hold.created",
    entityType: "LegalHold",
    entityId: hold.id,
    metadata: {
      heldEntityType: hold.entityType,
      heldEntityId: hold.entityId,
    },
  });

  return NextResponse.json({
    ok: true,
    hold,
  });
}
