import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  ContactSegmentBuilderError,
  assertSegmentLimit,
  createContactSegment,
  listContactSegments,
  previewSegmentRules,
} from "@/server/services/contact-segment-builder.service";
import { CreateSegmentSchema } from "@/server/validators/contact-segment.validator";

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const segments = await listContactSegments({
    companyId: workspace.membership.companyId,
  });

  return NextResponse.json({ ok: true, segments });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = CreateSegmentSchema.parse(await request.json());

    await assertSegmentLimit(workspace.membership.companyId);

    const segment = await createContactSegment({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      name: body.name,
      description: body.description,
      matchMode: body.matchMode,
      rules: body.rules,
    });

    const preview = await previewSegmentRules({
      companyId: workspace.membership.companyId,
      matchMode: body.matchMode,
      rules: body.rules,
    }).catch(() => null);

    if (preview) {
      await prisma.contactSegment.update({
        where: { id: segment.id },
        data: { lastPreviewCount: preview.count, lastPreviewAt: new Date() },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        segment,
        previewCount: preview?.count ?? null,
        warnings: preview?.warnings ?? [],
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ContactSegmentBuilderError) {
      return NextResponse.json(
        { ok: false, code: "CONTACT_SEGMENT_ERROR", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid segment details", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    throw error;
  }
}
