import { NextResponse } from "next/server";
import { AuthorizationError } from "@/server/auth/authorization";

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

  throw error;
}
