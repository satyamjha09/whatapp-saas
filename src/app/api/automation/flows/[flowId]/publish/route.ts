import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationFlowNotFoundError,
  AutomationPublishBlockedError,
  AutomationPublishConflictError,
  publishAutomationFlow,
} from "@/server/services/automation-versioning.service";

const publishAutomationFlowSchema = z.object({
  allowWarnings: z.boolean().optional(),
  publishNotes: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> },
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

    const { flowId } = await params;

    const { requireAutomationPermission } = await import("@/server/services/automation-permission.service");
    await requireAutomationPermission(
      context.membership.companyId,
      context.user.id,
      "automation.flow.publish"
    );

    const body = await request.json().catch(() => ({}));
    const validation = publishAutomationFlowSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid publish input",
        },
        { status: 400 },
      );
    }

    const result = await publishAutomationFlow(
      context.membership.companyId,
      flowId,
      validation.data,
      context.user.id,
    );

    return NextResponse.json({
      flow: {
        id: result.flow.id,
        publishedAt: result.flow.publishedAt,
        publishedVersionId: result.flow.publishedVersionId,
        status: result.flow.status,
      },
      validation: result.validation,
      version: {
        id: result.version.id,
        publishedAt: result.version.publishedAt,
        publishNotes: result.version.publishNotes,
        versionNumber: result.version.versionNumber,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err?.name === "AutomationPermissionDeniedError") {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }

    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof AutomationPublishBlockedError) {
      return NextResponse.json(
        {
          errors: error.errors,
          message: error.message,
          warnings: error.warnings,
        },
        { status: error.statusCode },
      );
    }

    if (error instanceof AutomationPublishConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("AUTOMATION_PUBLISH_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to publish automation flow" },
      { status: 500 },
    );
  }
}
