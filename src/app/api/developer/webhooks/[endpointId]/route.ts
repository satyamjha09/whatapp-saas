import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { revokeDeveloperWebhookEndpoint } from "@/server/services/developer-webhook.service";

type RevokeDeveloperWebhookRouteContext = {
  params: Promise<{
    endpointId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: RevokeDeveloperWebhookRouteContext,
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
        { message: "You do not have permission to revoke webhooks" },
        { status: 403 },
      );
    }

    const { endpointId } = await params;

    const endpoint = await revokeDeveloperWebhookEndpoint(
      context.membership.companyId,
      endpointId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.revoked",
      entityType: "DeveloperWebhookEndpoint",
      entityId: endpoint.id,
      metadata: {
        name: endpoint.name,
        url: endpoint.url,
      },
    });

    return NextResponse.json({
      message: "Webhook endpoint revoked successfully",
      endpoint,
    });
  } catch (error) {
    console.error("REVOKE_DEVELOPER_WEBHOOK_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Webhook endpoint not found",
        "Webhook endpoint is already revoked",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to revoke webhook endpoint" },
      { status: 500 },
    );
  }
}
