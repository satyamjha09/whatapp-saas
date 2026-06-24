import { NextResponse } from "next/server";
import { RbacPermission } from "@/generated/prisma/client";
import { assertRouteFeatureEntitlement } from "@/server/auth/feature-entitlement-guard";
import { FeatureEntitlementError } from "@/server/services/feature-entitlement.service";
import { getRequiredPermissionForRoute } from "@/server/auth/rbac-route-permissions";
import {
  assertUserPermission,
  PermissionDeniedError,
} from "@/server/services/rbac-v2.service";

type WorkspaceLike = {
  user: { id: string };
  membership: { companyId: string } | null;
};

export async function assertRoutePermission({
  request,
  workspace,
  permission,
}: {
  request: Request;
  workspace: WorkspaceLike;
  permission?: RbacPermission;
}) {
  await assertRouteFeatureEntitlement({ request, workspace });

  const requiredPermission =
    permission ??
    getRequiredPermissionForRoute({
      pathname: new URL(request.url).pathname,
      method: request.method,
    })?.permission;

  if (!requiredPermission) return;
  if (!workspace.membership) {
    throw new Error("Workspace membership is required for permission checks");
  }
  await assertUserPermission({
    companyId: workspace.membership.companyId,
    userId: workspace.user.id,
    permission: requiredPermission,
  });
}

export function createRoutePermissionErrorResponse(error: unknown) {
  if (error instanceof FeatureEntitlementError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: 402 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: error instanceof PermissionDeniedError ? "PERMISSION_DENIED" : "PERMISSION_ERROR",
      message: error instanceof PermissionDeniedError ? error.message : "Permission check failed",
    },
    { status: 403 },
  );
}
