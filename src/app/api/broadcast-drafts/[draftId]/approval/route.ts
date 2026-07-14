import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { updateBroadcastDraftApproval } from "@/server/services/broadcast-collaboration.service";

type BroadcastDraftApprovalRouteContext = {
  params: Promise<{ draftId: string }>;
};

const approvalSchema = z.object({
  action: z.enum(["SUBMIT", "APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

function actorLabel(context: NonNullable<Awaited<ReturnType<typeof getCurrentWorkspaceContext>>>) {
  return context.user.name || context.user.email || "Unknown user";
}

function canReview(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: BroadcastDraftApprovalRouteContext,
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

    const validation = approvalSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid approval action",
        },
        { status: 400 },
      );
    }

    if (
      ["APPROVE", "REJECT"].includes(validation.data.action) &&
      !canReview(context.membership.role)
    ) {
      return NextResponse.json(
        { message: "Only owners and admins can review broadcasts" },
        { status: 403 },
      );
    }

    const { draftId } = await params;
    const result = await updateBroadcastDraftApproval({
      action: validation.data.action,
      actor: {
        id: context.user.id,
        label: actorLabel(context),
      },
      companyId: context.membership.companyId,
      draftId,
      note: validation.data.note,
    });

    return NextResponse.json({
      ...result,
      message: "Broadcast approval updated",
    });
  } catch (error) {
    console.error("BROADCAST_APPROVAL_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to update broadcast approval",
      },
      { status: 400 },
    );
  }
}
