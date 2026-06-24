import { NextResponse } from "next/server";
import { AuthorizationError } from "@/server/auth/authorization";
import { PermissionDeniedError } from "@/server/services/rbac-v2.service";
import { FeatureEntitlementError } from "@/server/services/feature-entitlement.service";

export function createAuthorizationErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  if (error instanceof PermissionDeniedError) {
    return NextResponse.json(
      { ok: false, code: "PERMISSION_DENIED", message: error.message },
      { status: 403 },
    );
  }

  if (error instanceof FeatureEntitlementError) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: 402 },
    );
  }

  throw error;
}
