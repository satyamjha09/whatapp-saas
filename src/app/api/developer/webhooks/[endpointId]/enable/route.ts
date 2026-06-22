import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { reEnableDeveloperWebhookEndpoint } from "@/server/services/developer-webhook-health.service";

type EnableWebhookRouteContext = {
  params: Promise<{
    endpointId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: EnableWebhookRouteContext,
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
        { message: "Only owners and admins can enable webhooks" },
        { status: 403 },
      );
    }

    await assertCompanyFeature(
      context.membership.companyId,
      "DEVELOPER_WEBHOOKS",
    );

    const { endpointId } = await params;
    const endpoint = await prisma.developerWebhookEndpoint.findFirst({
      where: {
        id: endpointId,
        companyId: context.membership.companyId,
      },
    });

    if (!endpoint) {
      return NextResponse.json(
        { message: "Developer webhook not found" },
        { status: 404 },
      );
    }

    if (endpoint.status === "REVOKED") {
      return NextResponse.json(
        { message: "Revoked webhooks cannot be re-enabled" },
        { status: 400 },
      );
    }

    const updatedEndpoint = await reEnableDeveloperWebhookEndpoint(endpoint.id);

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.enabled",
      entityType: "DeveloperWebhookEndpoint",
      entityId: endpoint.id,
      metadata: {
        webhookName: endpoint.name,
        previousAutoDisabledAt: endpoint.autoDisabledAt,
        previousAutoDisabledReason: endpoint.autoDisabledReason,
      },
    });

    return NextResponse.json({
      message: "Developer webhook enabled successfully",
      endpoint: updatedEndpoint,
    });
  } catch (error) {
    console.error("ENABLE_DEVELOPER_WEBHOOK_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Subscription is past due",
        "DEVELOPER_WEBHOOKS is not available on the Free plan",
        "DEVELOPER_WEBHOOKS is not available on the Starter plan",
      ].some((message) => error.message.includes(message))
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to enable developer webhook" },
      { status: 500 },
    );
  }
}
