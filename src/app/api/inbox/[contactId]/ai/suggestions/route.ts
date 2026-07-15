import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import {
  generateInboxAiSuggestion,
  getRecentInboxAiSuggestions,
  normalizeInboxAiTone,
} from "@/server/services/inbox-ai-suggestion.service";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";

type RouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
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

    await assertRoutePermission({ request, workspace: context });

    const { contactId } = await params;

    try {
      await assertTenantEntityAccess({
        request,
        companyId: context.membership.companyId,
        entityType: "Contact",
        entityId: contactId,
      });
    } catch (error) {
      return createTenantErrorResponse(error);
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const suggestion = await generateInboxAiSuggestion({
      companyId: context.membership.companyId,
      contactId,
      userId: context.user.id,
      tone: normalizeInboxAiTone(body.tone),
    });

    return NextResponse.json({
      message:
        suggestion.status === "FAILED"
          ? "AI suggestion failed without blocking the inbox"
          : "AI suggestion generated",
      suggestion,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "PermissionDeniedError") {
      return createRoutePermissionErrorResponse(error);
    }

    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return createRoutePermissionErrorResponse(error);
  }
}

export async function GET(request: Request, { params }: RouteContext) {
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

    await assertRoutePermission({
      request,
      workspace: context,
      permission: "INBOX_VIEW",
    });

    const { contactId } = await params;
    const suggestions = await getRecentInboxAiSuggestions({
      companyId: context.membership.companyId,
      contactId,
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }
}
