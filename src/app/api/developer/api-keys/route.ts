import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createApiKeyForCompany,
  getApiKeysByCompany,
} from "@/server/services/api-key.service";
import { createAuditLog } from "@/server/services/audit.service";
import { createApiKeySchema } from "@/server/validators/api-key.validator";
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

    await assertCompanyFeature(context.membership.companyId, "DEVELOPER_API");

    const apiKeys = await getApiKeysByCompany(context.membership.companyId);

    return NextResponse.json({
      apiKeys,
    });
  } catch (error) {
    console.error("GET_API_KEYS_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("DEVELOPER_API is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to fetch API keys" },
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
        { message: "You do not have permission to create API keys" },
        { status: 403 },
      );
    }

    await assertCompanyFeature(context.membership.companyId, "DEVELOPER_API");

    const body: unknown = await request.json();

    const validation = createApiKeySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid API key details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { apiKey, record } = await createApiKeyForCompany(
      context.membership.companyId,
      context.user.id,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "developer.api_key.created",
      entityType: "ApiKey",
      entityId: record.id,
      metadata: {
        name: record.name,
        keyPrefix: record.keyPrefix,
        keyLast4: record.keyLast4,
        scopes: record.scopes,
        allowedIps: record.allowedIps,
        expiresAt: record.expiresAt,
      },
    });

    return NextResponse.json(
      {
        message: "API key created successfully",
        apiKey,
        record,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_API_KEY_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("DEVELOPER_API is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to create API key" },
      { status: 500 },
    );
  }
}
