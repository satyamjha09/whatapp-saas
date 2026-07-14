import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createBroadcastDraftSchema } from "@/server/validators/broadcast-draft.validator";

function canManageBroadcasts(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

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

    const drafts = await prisma.broadcastCampaignDraft.findMany({
      where: {
        companyId: context.membership.companyId,
        status: "DRAFT",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 20,
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("LIST_BROADCAST_DRAFTS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch broadcast drafts" },
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

    if (!canManageBroadcasts(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to manage broadcasts" },
        { status: 403 },
      );
    }

    const validation = createBroadcastDraftSchema.safeParse(
      await request.json(),
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid broadcast draft details",
        },
        { status: 400 },
      );
    }

    const draft = await prisma.broadcastCampaignDraft.create({
      data: {
        companyId: context.membership.companyId,
        createdByUserId: context.user.id,
        currentStep: validation.data.currentStep,
        draftData: validation.data.draftData as Prisma.InputJsonValue,
        name: validation.data.name,
        objective: validation.data.objective,
      },
    });

    return NextResponse.json(
      {
        draft,
        message: "Broadcast draft saved",
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_BROADCAST_DRAFT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to save broadcast draft" },
      { status: 500 },
    );
  }
}
