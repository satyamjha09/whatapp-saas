import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  ContactSegmentBuilderError,
  previewContactSegment,
} from "@/server/services/contact-segment-builder.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ segmentId: string }> },
) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const { segmentId } = await params;
    const preview = await previewContactSegment({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      segmentId,
    });

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof ContactSegmentBuilderError) {
      return NextResponse.json(
        { ok: false, code: "CONTACT_SEGMENT_ERROR", message: error.message },
        { status: 400 },
      );
    }

    throw error;
  }
}
