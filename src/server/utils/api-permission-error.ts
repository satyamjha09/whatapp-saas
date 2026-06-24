import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/server/services/rbac-v2.service";

export function createPermissionErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      ok: false,
      code: error instanceof PermissionDeniedError ? "PERMISSION_DENIED" : "PERMISSION_ERROR",
      message: error instanceof PermissionDeniedError ? error.message : "Permission check failed",
    },
    { status: 403 },
  );
}
