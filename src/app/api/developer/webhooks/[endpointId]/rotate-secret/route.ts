import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import {
  encryptDeveloperWebhookSigningSecret,
  generateDeveloperWebhookSigningSecret,
  getSecretPreview,
} from "@/server/services/developer-webhook-signature.service";

type RotateSecretRouteContext = {
  params: Promise<{
    endpointId: string;
  }>;
};

export async function POST(
  _request: Request,
  { params }: RotateSecretRouteContext,
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
        { message: "Only owners and admins can rotate webhook secrets" },
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

    if (endpoint.status !== "ACTIVE") {
      return NextResponse.json(
        { message: "Webhook endpoint is not active" },
        { status: 400 },
      );
    }

    const signingSecret = generateDeveloperWebhookSigningSecret();
    const updatedEndpoint = await prisma.developerWebhookEndpoint.update({
      where: {
        id: endpoint.id,
      },
      data: {
        signingSecretEncrypted:
          encryptDeveloperWebhookSigningSecret(signingSecret),
        secretPrefix: signingSecret.slice(0, 10),
        secretLast4: signingSecret.slice(-4),
        signingSecretPreview: getSecretPreview(signingSecret),
        signingSecretRotatedAt: new Date(),
      },
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.signing_secret_rotated",
      entityType: "DeveloperWebhookEndpoint",
      entityId: endpoint.id,
      metadata: {
        webhookName: endpoint.name,
        signingSecretPreview: updatedEndpoint.signingSecretPreview,
      },
    });

    return NextResponse.json({
      message: "Webhook signing secret rotated successfully",
      endpoint: updatedEndpoint,
      signingSecret,
    });
  } catch (error) {
    console.error("ROTATE_DEVELOPER_WEBHOOK_SECRET_ERROR:", error);

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
      { message: "Unable to rotate webhook signing secret" },
      { status: 500 },
    );
  }
}
