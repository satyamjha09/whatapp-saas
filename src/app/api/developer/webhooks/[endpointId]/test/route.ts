import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { sendTestDeveloperWebhook } from "@/server/services/developer-webhook.service";

type TestDeveloperWebhookRouteContext = {
  params: Promise<{
    endpointId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: TestDeveloperWebhookRouteContext,
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
        { message: "You do not have permission to test webhooks" },
        { status: 403 },
      );
    }

    const { endpointId } = await params;

    const delivery = await sendTestDeveloperWebhook(
      context.membership.companyId,
      endpointId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.test_sent",
      entityType: "DeveloperWebhookDelivery",
      entityId: delivery.id,
      metadata: {
        endpointId,
        eventType: delivery.eventType,
      },
    });

    return NextResponse.json({
      message: "Test webhook queued successfully",
      delivery,
    });
  } catch (error) {
    console.error("TEST_DEVELOPER_WEBHOOK_ERROR:", error);

    if (
      error instanceof Error &&
      ["Webhook endpoint not found", "Webhook endpoint is not active"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to test webhook endpoint" },
      { status: 500 },
    );
  }
}
