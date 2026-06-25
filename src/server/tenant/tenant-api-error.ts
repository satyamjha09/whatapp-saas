import { NextResponse } from "next/server";
import { TenantAccessError } from "./tenant-context";

export function createTenantErrorResponse(error: unknown) {
  if (error instanceof TenantAccessError) {
    return NextResponse.json(
      {
        ok: false,
        code: "TENANT_ACCESS_ERROR",
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      code: "UNKNOWN_ERROR",
      message: "Something went wrong.",
    },
    {
      status: 500,
    },
  );
}
