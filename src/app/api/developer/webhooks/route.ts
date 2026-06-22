import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  createDeveloperWebhookEndpointForCompany,
  getDeveloperWebhookEndpointsByCompany,
} from "@/server/services/developer-webhook.service";
import { createDeveloperWebhookEndpointSchema } from "@/server/validators/developer-webhook.validator";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";

export async function GET() {
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

    await assertCompanyFeature(
      context.membership.companyId,
      "DEVELOPER_WEBHOOKS",
    );

    const endpoints = await getDeveloperWebhookEndpointsByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({
      endpoints,
    });
  } catch (error) {
    console.error("GET_DEVELOPER_WEBHOOKS_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("DEVELOPER_WEBHOOKS is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to fetch webhook endpoints" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
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
        { message: "You do not have permission to create webhooks" },
        { status: 403 },
      );
    }

    await assertCompanyFeature(
      context.membership.companyId,
      "DEVELOPER_WEBHOOKS",
    );

    const body: unknown = await request.json();
    const validation = createDeveloperWebhookEndpointSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid webhook details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { endpoint, signingSecret } =
      await createDeveloperWebhookEndpointForCompany(
        context.membership.companyId,
        validation.data,
      );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.webhook.created",
      entityType: "DeveloperWebhookEndpoint",
      entityId: endpoint.id,
      metadata: {
        name: endpoint.name,
        url: endpoint.url,
      },
    });

    return NextResponse.json(
      {
        message: "Webhook endpoint created successfully",
        endpoint,
        signingSecret,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_DEVELOPER_WEBHOOK_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("DEVELOPER_WEBHOOKS is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to create webhook endpoint" },
      { status: 500 },
    );
  }
}
