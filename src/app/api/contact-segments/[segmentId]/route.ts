import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  ContactSegmentBuilderError,
  deleteContactSegment,
  getContactSegmentDetail,
  updateContactSegment,
} from "@/server/services/contact-segment-builder.service";
import { UpdateSegmentSchema } from "@/server/validators/contact-segment.validator";

type RouteContext = {
  params: Promise<{
    segmentId: string;
  }>;
};

function segmentErrorResponse(error: unknown) {
  if (error instanceof ContactSegmentBuilderError) {
    return NextResponse.json(
      { ok: false, code: "CONTACT_SEGMENT_ERROR", message: error.message },
      { status: error.message === "Segment not found." ? 404 : 400 },
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

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const { segmentId } = await context.params;

    const segment = await getContactSegmentDetail({
      companyId: workspace.membership.companyId,
      segmentId,
    });

    return NextResponse.json({ ok: true, segment });
  } catch (error) {
    return segmentErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const { segmentId } = await context.params;
    const body = UpdateSegmentSchema.parse(await request.json());

    const segment = await updateContactSegment({
      companyId: workspace.membership.companyId,
      segmentId,
      actorUserId: workspace.user.id,
      name: body.name,
      description: body.description,
      status: body.status,
      matchMode: body.matchMode,
      rules: body.rules,
    });

    return NextResponse.json({ ok: true, segment });
  } catch (error) {
    return segmentErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const { segmentId } = await context.params;

    const result = await deleteContactSegment({
      companyId: workspace.membership.companyId,
      segmentId,
      actorUserId: workspace.user.id,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return segmentErrorResponse(error);
  }
}
