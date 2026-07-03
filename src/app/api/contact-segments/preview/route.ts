import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  ContactSegmentBuilderError,
  previewSegmentRules,
} from "@/server/services/contact-segment-builder.service";
import { PreviewSegmentRulesSchema } from "@/server/validators/contact-segment.validator";

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = PreviewSegmentRulesSchema.parse(await request.json());

    const preview = await previewSegmentRules({
      companyId: workspace.membership.companyId,
      matchMode: body.matchMode,
      rules: body.rules,
    });

    return NextResponse.json({ ok: true, ...preview });
  } catch (error) {
    if (error instanceof ContactSegmentBuilderError) {
      return NextResponse.json(
        { ok: false, code: "CONTACT_SEGMENT_ERROR", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid segment rules", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    throw error;
  }
}
