import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { revokeDeveloperWebhookEndpoint } from "@/server/services/developer-webhook.service";
import { developerWebhookSchema } from "@/server/validators/developer-webhook.validator";
import { assertRoutePermission, createRoutePermissionErrorResponse } from "@/server/auth/route-permission-guard";

type RevokeDeveloperWebhookRouteContext = {
  params: Promise<{
    endpointId: string;
  }>;
};

function isDeveloperWebhookFeatureError(error: unknown) {
  return (
    error instanceof Error &&
    [
      "Subscription is past due",
      "DEVELOPER_WEBHOOKS is not available on the Free plan",
      "DEVELOPER_WEBHOOKS is not available on the Starter plan",
    ].some((message) => error.message.includes(message))
  );
}

export async function PATCH(
  request: Request,
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
        { message: "Only owners and admins can update webhooks" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }
    await assertCompanyFeature(
      context.membership.companyId,
      "DEVELOPER_WEBHOOKS",
    );

    const body: unknown = await request.json();
    const validation = developerWebhookSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid webhook details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

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
        { message: "Revoked webhooks cannot be edited" },
        { status: 400 },
      );
    }

    const updatedEndpoint = await prisma.developerWebhookEndpoint.update({
      where: {
        id: endpoint.id,
      },
      data: {
        name: validation.data.name,
        url: validation.data.url,
        events: validation.data.events,
        payloadVersion: validation.data.payloadVersion,
      },
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.updated",
      entityType: "DeveloperWebhookEndpoint",
      entityId: endpoint.id,
      metadata: {
        name: updatedEndpoint.name,
        url: updatedEndpoint.url,
        events: updatedEndpoint.events,
        payloadVersion: updatedEndpoint.payloadVersion,
      },
    });

    return NextResponse.json({
      message: "Developer webhook updated successfully",
      endpoint: updatedEndpoint,
    });
  } catch (error) {
    console.error("UPDATE_DEVELOPER_WEBHOOK_ERROR:", error);

    if (isDeveloperWebhookFeatureError(error)) {
      return NextResponse.json(
        { message: (error as Error).message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { message: "Unable to update developer webhook" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
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

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
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

    if (isDeveloperWebhookFeatureError(error)) {
      return NextResponse.json(
        { message: (error as Error).message },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { message: "Unable to revoke webhook endpoint" },
      { status: 500 },
    );
  }
}
