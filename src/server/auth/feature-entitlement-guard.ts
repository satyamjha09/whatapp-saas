import { NextResponse } from "next/server";
import { FeatureEntitlementKey } from "@/generated/prisma/client";
import { getFeatureForRoute } from "@/server/auth/feature-route-entitlements";
import {
  assertCompanyFeatureAccess,
  FeatureEntitlementError,
} from "@/server/services/feature-entitlement.service";

type WorkspaceLike = {
  user: { id: string };
  membership: { companyId: string } | null;
};

export async function assertRouteFeatureEntitlement({
  request,
  workspace,
  featureKey,
}: {
  request: Request;
  workspace: WorkspaceLike;
  featureKey?: FeatureEntitlementKey;
}) {
  const url = new URL(request.url);
  const resolvedFeature =
    featureKey ?? getFeatureForRoute({ pathname: url.pathname, method: request.method })?.featureKey;
  if (!resolvedFeature) return;
  if (!workspace.membership) throw new Error("Workspace membership is required for entitlement checks");

  await assertCompanyFeatureAccess({
    companyId: workspace.membership.companyId,
    userId: workspace.user.id,
    featureKey: resolvedFeature,
    routePath: url.pathname,
    method: request.method,
  });
}

export function createFeatureEntitlementErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      ok: false,
      code: error instanceof FeatureEntitlementError ? error.code : "FEATURE_ENTITLEMENT_ERROR",
      message: error instanceof FeatureEntitlementError ? error.message : "Feature entitlement check failed",
    },
    { status: 402 },
  );
}
