import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";
import {
  ContactSegmentBuilderError,
  createContactSegment,
  listContactSegments,
} from "@/server/services/contact-segment-builder.service";

const RuleSchema = z.object({
  field: z.enum([
    "PHONE",
    "NAME",
    "EMAIL",
    "SOURCE",
    "CITY",
    "TAG",
    "MARKETING_CONSENT",
    "UTILITY_CONSENT",
    "CREATED_AT",
    "LAST_MESSAGE_AT",
    "CUSTOM_FIELD",
    "CAMPAIGN_OUTCOME",
  ]),
  operator: z.enum([
    "EQUALS",
    "NOT_EQUALS",
    "CONTAINS",
    "NOT_CONTAINS",
    "STARTS_WITH",
    "ENDS_WITH",
    "IN",
    "NOT_IN",
    "EXISTS",
    "NOT_EXISTS",
    "BEFORE",
    "AFTER",
    "BETWEEN",
  ]),
  customFieldKey: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
  values: z
    .union([z.array(z.string()), z.record(z.string(), z.unknown())])
    .optional()
    .nullable(),
});

const CreateSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().optional().nullable(),
  matchMode: z.enum(["ALL", "ANY"]).default("ALL"),
  rules: z.array(RuleSchema).default([]),
});

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
    const body = CreateSchema.parse(await request.json());
    const segment = await createContactSegment({
      companyId: workspace.membership.companyId,
      actorUserId: workspace.user.id,
      name: body.name,
      description: body.description,
      matchMode: body.matchMode,
      rules: body.rules,
    });

    return NextResponse.json({ ok: true, segment }, { status: 201 });
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
