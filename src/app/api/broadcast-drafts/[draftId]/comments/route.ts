import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { addBroadcastDraftComment } from "@/server/services/broadcast-collaboration.service";

type BroadcastDraftCommentsRouteContext = {
  params: Promise<{ draftId: string }>;
};

const commentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

function actorLabel(context: NonNullable<Awaited<ReturnType<typeof getCurrentWorkspaceContext>>>) {
  return context.user.name || context.user.email || "Unknown user";
}

export async function POST(
  request: Request,
  { params }: BroadcastDraftCommentsRouteContext,
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

    const validation = commentSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid comment",
        },
        { status: 400 },
      );
    }

    const { draftId } = await params;
    const result = await addBroadcastDraftComment({
      actor: {
        id: context.user.id,
        label: actorLabel(context),
      },
      body: validation.data.body,
      companyId: context.membership.companyId,
      draftId,
    });

    return NextResponse.json({
      ...result,
      message: "Comment added",
    });
  } catch (error) {
    console.error("BROADCAST_COMMENT_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to add comment",
      },
      { status: 400 },
    );
  }
}
