import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import {
  PlatformAuthorizationError,
  requirePlatformAdmin,
} from "@/server/auth/platform-admin";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

export type BillingOpsActor = {
  authorization: "COMPANY_ADMIN" | "PLATFORM_ADMIN";
  companyId: string | null;
  userId: string;
};

type BillingOpsAuthorizationResult =
  | {
      ok: true;
      actor: BillingOpsActor;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function authorizeBillingManualReview(
  request: Request,
): Promise<BillingOpsAuthorizationResult> {
  try {
    const platform = await requirePlatformAdmin({ request });

    if (!platform.user) {
      return {
        ok: false,
        response: NextResponse.json(
          { message: "Platform admin user record not found" },
          { status: 403 },
        ),
      };
    }

    return {
      ok: true,
      actor: {
        authorization: "PLATFORM_ADMIN",
        companyId: null,
        userId: platform.user.id,
      },
    };
  } catch (error) {
    if (!(error instanceof PlatformAuthorizationError)) {
      throw error;
    }
  }

  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return {
      ok: false,
      response: createAuthorizationErrorResponse(error),
    };
  }

  try {
    await assertRoutePermission({
      request,
      workspace,
      permission: "BILLING_MANAGE",
    });
  } catch (error) {
    return {
      ok: false,
      response: createRoutePermissionErrorResponse(error),
    };
  }

  return {
    ok: true,
    actor: {
      authorization: "COMPANY_ADMIN",
      companyId: workspace.membership.companyId,
      userId: workspace.user.id,
    },
  };
}
