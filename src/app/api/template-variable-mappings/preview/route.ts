import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  previewTemplateVariableMapping,
  TemplateVariableMappingError,
} from "@/server/services/template-variable-mapping.service";

const PreviewSchema = z.object({
  templateName: z.string().trim().min(1),
  templateLanguage: z.string().optional().nullable(),
  templateBody: z.string().min(1),
  segmentId: z.string().min(1),
});

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = PreviewSchema.parse(await request.json());
    const preview = await previewTemplateVariableMapping({
      companyId: workspace.membership.companyId,
      templateName: body.templateName,
      templateLanguage: body.templateLanguage,
      templateBody: body.templateBody,
      segmentId: body.segmentId,
    });

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    if (error instanceof TemplateVariableMappingError) {
      return NextResponse.json(
        { ok: false, code: "TEMPLATE_VARIABLE_MAPPING_ERROR", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid preview details", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    throw error;
  }
}
