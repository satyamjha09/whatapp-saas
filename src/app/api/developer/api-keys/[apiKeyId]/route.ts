import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  revokeApiKey,
  updateApiKeyForCompany,
} from "@/server/services/api-key.service";
import { createAuditLog } from "@/server/services/audit.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { updateApiKeySchema } from "@/server/validators/api-key.validator";
import { assertRoutePermission, createRoutePermissionErrorResponse } from "@/server/auth/route-permission-guard";

type RevokeApiKeyRouteContext = {
  params: Promise<{
    apiKeyId: string;
  }>;
};

function isDeveloperApiFeatureError(error: unknown) {
  return (
    error instanceof Error &&
    [
      "Subscription is past due",
      "DEVELOPER_API is not available on the Free plan",
      "DEVELOPER_API is not available on the Starter plan",
    ].some((message) => error.message.includes(message))
  );
}

export async function PATCH(
  request: Request,
  { params }: RevokeApiKeyRouteContext,
) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to edit API keys" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }
    await assertCompanyFeature(context.membership.companyId, "DEVELOPER_API");

    const body: unknown = await request.json();
    const validation = updateApiKeySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid API key details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { apiKeyId } = await params;
    const apiKey = await updateApiKeyForCompany(
      context.membership.companyId,
      apiKeyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.api_key.updated",
      entityType: "ApiKey",
      entityId: apiKey.id,
      metadata: {
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        keyLast4: apiKey.keyLast4,
        scopes: apiKey.scopes,
        allowedIps: apiKey.allowedIps,
        expiresAt: apiKey.expiresAt,
      },
    });

    return NextResponse.json({
      message: "API key updated successfully",
      apiKey,
    });
  } catch (error) {
    console.error("UPDATE_API_KEY_ERROR:", error);

    if (
      error instanceof Error &&
      ["API key not found", "Cannot edit a revoked API key"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (isDeveloperApiFeatureError(error)) {
      return NextResponse.json(
        { message: (error as Error).message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { message: "Unable to update API key" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RevokeApiKeyRouteContext,
) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to revoke API keys" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const { apiKeyId } = await params;

    await assertCompanyFeature(context.membership.companyId, "DEVELOPER_API");

    const apiKey = await revokeApiKey(context.membership.companyId, apiKeyId);

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.api_key.revoked",
      entityType: "ApiKey",
      entityId: apiKey.id,
      metadata: {
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        keyLast4: apiKey.keyLast4,
      },
    });

    return NextResponse.json({
      message: "API key revoked successfully",
      apiKey,
    });
  } catch (error) {
    console.error("REVOKE_API_KEY_ERROR:", error);

    if (
      error instanceof Error &&
      ["API key not found", "API key is already revoked"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (isDeveloperApiFeatureError(error)) {
      return NextResponse.json(
        { message: (error as Error).message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { message: "Unable to revoke API key" },
      { status: 500 },
    );
  }
}
