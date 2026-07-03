import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  ContactSegmentBuilderError,
  getSegmentContactsPage,
} from "@/server/services/contact-segment-builder.service";
import { SegmentContactsQuerySchema } from "@/server/validators/contact-segment.validator";

type RouteContext = {
  params: Promise<{
    segmentId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const { segmentId } = await context.params;
    const url = new URL(request.url);

    const query = SegmentContactsQuerySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    const result = await getSegmentContactsPage({
      companyId: workspace.membership.companyId,
      segmentId,
      page: query.page,
      pageSize: query.pageSize,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ContactSegmentBuilderError) {
      return NextResponse.json(
        { ok: false, code: "CONTACT_SEGMENT_ERROR", message: error.message },
        { status: error.message === "Segment not found." ? 404 : 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid query" },
        { status: 400 },
      );
    }

    throw error;
  }
}
