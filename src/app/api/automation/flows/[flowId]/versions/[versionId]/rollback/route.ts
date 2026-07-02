import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationFlowNotFoundError,
  AutomationPublishConflictError,
  rollbackAutomationFlowVersion,
} from "@/server/services/automation-versioning.service";

const rollbackAutomationFlowSchema = z.object({
  publishNotes: z.string().trim().max(1000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string; versionId: string }> },
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

    const { flowId, versionId } = await params;
    const body = await request.json().catch(() => ({}));
    const validation = rollbackAutomationFlowSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid rollback input",
        },
        { status: 400 },
      );
    }

    const result = await rollbackAutomationFlowVersion(
      context.membership.companyId,
      flowId,
      versionId,
      context.user.id,
      validation.data,
    );

    return NextResponse.json({
      flow: {
        id: result.flow.id,
        publishedAt: result.flow.publishedAt,
        publishedVersionId: result.flow.publishedVersionId,
        status: result.flow.status,
      },
      graph: result.sourceVersion.graph,
      sourceVersion: {
        id: result.sourceVersion.id,
        versionNumber: result.sourceVersion.versionNumber,
      },
      version: {
        id: result.version.id,
        isRollback: result.version.isRollback,
        publishedAt: result.version.publishedAt,
        publishNotes: result.version.publishNotes,
        rollbackFromVersionId: result.version.rollbackFromVersionId,
        versionNumber: result.version.versionNumber,
      },
    });
  } catch (error) {
    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof AutomationPublishConflictError) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    console.error("AUTOMATION_ROLLBACK_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to rollback automation version" },
      { status: 500 },
    );
  }
}
