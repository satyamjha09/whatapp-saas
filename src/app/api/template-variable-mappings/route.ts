import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  saveTemplateVariableMappings,
  TemplateVariableMappingError,
} from "@/server/services/template-variable-mapping.service";

const MappingSchema = z.object({
  variableKey: z.string().trim().min(1),
  source: z.enum(["CONTACT_FIELD", "CUSTOM_FIELD", "STATIC_VALUE", "SYSTEM_VALUE"]),
  contactField: z.string().optional().nullable(),
  customFieldKey: z.string().optional().nullable(),
  staticValue: z.string().optional().nullable(),
  systemValueKey: z.string().optional().nullable(),
  fallbackValue: z.string().optional().nullable(),
  isRequired: z.boolean().optional(),
});

const SaveSchema = z.object({
  templateId: z.string().optional().nullable(),
  templateName: z.string().trim().min(1),
  templateLanguage: z.string().optional().nullable(),
  segmentId: z.string().optional().nullable(),
  mappings: z.array(MappingSchema),
});

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = SaveSchema.parse(await request.json());
    const mappings = await saveTemplateVariableMappings({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      templateId: body.templateId,
      templateName: body.templateName,
      templateLanguage: body.templateLanguage,
      segmentId: body.segmentId,
      mappings: body.mappings,
    });

    return NextResponse.json({ ok: true, mappings });
  } catch (error) {
    if (error instanceof TemplateVariableMappingError) {
      return NextResponse.json(
        { ok: false, code: "TEMPLATE_VARIABLE_MAPPING_ERROR", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, code: "VALIDATION_ERROR", message: "Invalid mapping details", errors: error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    throw error;
  }
}
