import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  appendBroadcastHistory,
  getBroadcastDraftData,
} from "@/server/services/broadcast-collaboration.service";
import { updateBroadcastDraftSchema } from "@/server/validators/broadcast-draft.validator";

type BroadcastDraftRouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

function canManageBroadcasts(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

function actorLabel(
  context: NonNullable<Awaited<ReturnType<typeof getCurrentWorkspaceContext>>>,
) {
  return context.user.name || context.user.email || "Unknown user";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function GET(
  _request: Request,
  { params }: BroadcastDraftRouteContext,
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

    const { draftId } = await params;
    const draft = await prisma.broadcastCampaignDraft.findFirst({
      where: {
        companyId: context.membership.companyId,
        id: draftId,
      },
    });

    if (!draft) {
      return NextResponse.json(
        { message: "Broadcast draft not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("GET_BROADCAST_DRAFT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch broadcast draft" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: BroadcastDraftRouteContext,
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

    if (!canManageBroadcasts(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to manage broadcasts" },
        { status: 403 },
      );
    }

    const validation = updateBroadcastDraftSchema.safeParse(
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

    const { draftId } = await params;
    const existingDraft = await prisma.broadcastCampaignDraft.findFirst({
      where: {
        companyId: context.membership.companyId,
        id: draftId,
      },
      select: {
        draftData: true,
        id: true,
      },
    });

    if (!existingDraft) {
      return NextResponse.json(
        { message: "Broadcast draft not found" },
        { status: 404 },
      );
    }

    const existingDraftData = getBroadcastDraftData(existingDraft.draftData);
    const existingCollaboration = asRecord(
      (existingDraftData as Record<string, unknown>).collaboration,
    );
    const hasExistingCollaboration =
      Object.keys(existingCollaboration).length > 0;
    const incomingDraftData =
      validation.data.draftData !== undefined
        ? getBroadcastDraftData(validation.data.draftData)
        : existingDraftData;
    const draftDataWithCollaboration = {
      ...incomingDraftData,
      ...(hasExistingCollaboration
        ? { collaboration: existingCollaboration }
        : {}),
    };
    const shouldRecordHistory =
      validation.data.currentStep !== undefined ||
      validation.data.draftData !== undefined ||
      validation.data.name !== undefined ||
      validation.data.objective !== undefined;
    const nextDraftData = shouldRecordHistory
      ? appendBroadcastHistory({
          actor: {
            id: context.user.id,
            label: actorLabel(context),
          },
          draftData: draftDataWithCollaboration,
          event: "DRAFT_UPDATED",
          metadata: {
            currentStep: validation.data.currentStep ?? null,
          },
          summary: "Saved broadcast draft changes",
        })
      : draftDataWithCollaboration;

    const draft = await prisma.broadcastCampaignDraft.update({
      where: {
        id: draftId,
      },
      data: {
        ...(validation.data.currentStep !== undefined
          ? { currentStep: validation.data.currentStep }
          : {}),
        ...(shouldRecordHistory
          ? {
              draftData: nextDraftData as Prisma.InputJsonValue,
            }
          : {}),
        ...(validation.data.name !== undefined
          ? { name: validation.data.name }
          : {}),
        ...(validation.data.objective !== undefined
          ? { objective: validation.data.objective }
          : {}),
      },
    });

    return NextResponse.json({
      draft,
      message: "Broadcast draft updated",
    });
  } catch (error) {
    console.error("UPDATE_BROADCAST_DRAFT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to update broadcast draft" },
      { status: 500 },
    );
  }
}
