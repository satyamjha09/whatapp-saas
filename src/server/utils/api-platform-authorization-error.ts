import { NextResponse } from "next/server";
import { PlatformAuthorizationError } from "@/server/auth/platform-admin";

export function createPlatformAuthorizationErrorResponse(error: unknown) {
  if (error instanceof PlatformAuthorizationError) {
    return NextResponse.json(
      {
        message: error.message,
      },
      {
        status: error.status,
      },
    );
  }

  throw error;
}
