import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { translateInboxMessage } from "@/server/services/inbox-translation.service";

type RouteContext = {
  params: Promise<{
    messageId: string;
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

    const { messageId } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const targetLanguage =
      typeof body.targetLanguage === "string" ? body.targetLanguage : "";
    const translation = await translateInboxMessage({
      companyId: context.membership.companyId,
      messageId,
      userId: context.user.id,
      targetLanguage,
      sourceLanguage:
        typeof body.sourceLanguage === "string" ? body.sourceLanguage : undefined,
    });

    return NextResponse.json({
      message:
        translation.status === "FAILED"
          ? "Translation failed without blocking the inbox"
          : "Message translated",
      translation,
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
