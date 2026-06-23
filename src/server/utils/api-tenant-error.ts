import { NextResponse } from "next/server";
import { TenantAccessError } from "@/server/auth/tenant-guard";

export function createTenantErrorResponse(error: unknown) {
  if (error instanceof TenantAccessError) {
    return NextResponse.json(
      {
        message: "Resource not found",
      },
      {
        status: error.status,
      },
    );
  }

  throw error;
}
