import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { revokeApiKey } from "@/server/services/api-key.service";
import { createAuditLog } from "@/server/services/audit.service";

type RevokeApiKeyRouteContext = {
  params: Promise<{
    apiKeyId: string;
  }>;
};

export async function DELETE(
  _request: Request,
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

    const { apiKeyId } = await params;

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

    return NextResponse.json(
      { message: "Unable to revoke API key" },
      { status: 500 },
    );
  }
}
