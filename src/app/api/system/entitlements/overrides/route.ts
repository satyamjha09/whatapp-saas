import { NextResponse } from "next/server";
import { z } from "zod";
import { FeatureEntitlementKey } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth/authorization";
import { requirePlatformAdmin } from "@/server/auth/platform-admin";
import { assertRoutePermission, createRoutePermissionErrorResponse } from "@/server/auth/route-permission-guard";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createCompanyEntitlementOverride,
  listCompanyEntitlementOverrides,
} from "@/server/services/feature-entitlement.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import { createPlatformAuthorizationErrorResponse } from "@/server/utils/api-platform-authorization-error";

const CreateOverrideSchema = z.object({
  companyId: z.string().min(1),
  featureKey: z.enum(FeatureEntitlementKey),
  enabledOverride: z.boolean().optional().nullable(),
  limitOverride: z.number().int().min(0).optional().nullable(),
  reason: z.string().max(1000).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
}).refine(
  (value) => value.enabledOverride !== undefined || value.limitOverride !== undefined,
  { message: "At least one override value is required" },
);

export async function GET(request: Request) {
  let workspace;
  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }
  try {
    await assertRoutePermission({ request, workspace, permission: "SYSTEM_OPERATIONS_MANAGE" });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }

  const overrides = await listCompanyEntitlementOverrides({
    companyId: workspace.membership.companyId,
  });
  return NextResponse.json({ ok: true, overrides });
}

export async function POST(request: Request) {
  let platform;
  try {
    platform = await requirePlatformAdmin({ request });
  } catch (error) {
    return createPlatformAuthorizationErrorResponse(error);
  }

  const validation = CreateOverrideSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json(
      { ok: false, message: "Invalid entitlement override", errors: validation.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const body = validation.data;
    const override = await createCompanyEntitlementOverride({
      companyId: body.companyId,
      featureKey: body.featureKey,
      enabledOverride: body.enabledOverride,
      limitOverride: body.limitOverride,
      reason: body.reason,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      createdByUserId: platform.user?.id,
    });
    await createAuditLog({
      companyId: override.companyId,
      actorUserId: platform.user?.id,
      action: "feature_entitlement.override_created",
      entityType: "CompanyEntitlementOverride",
      entityId: override.id,
      metadata: {
        featureKey: override.featureKey,
        enabledOverride: override.enabledOverride,
        limitOverride: override.limitOverride,
        expiresAt: override.expiresAt,
      },
    });
    return NextResponse.json({ ok: true, override }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Unable to create override" },
      { status: 400 },
    );
  }
}
