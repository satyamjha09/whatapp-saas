import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import {
  CampaignReplyAttributionError,
  createManualCampaignConversion,
} from "@/server/services/campaign-reply-attribution.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const ConversionSchema = z.object({
  campaignId: z.string().min(1),
  contactId: z.string().min(1).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  type: z.enum([
    "DEMO_BOOKED",
    "MEETING_DONE",
    "PAYMENT_RECEIVED",
    "LEAD_WON",
    "LEAD_LOST",
  ]),
  valuePaise: z.number().int().nonnegative().optional().nullable(),
});

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = ConversionSchema.parse(await request.json());
    const event = await createManualCampaignConversion({
      actorUserId: workspace.user.id,
      campaignId: body.campaignId,
      companyId: workspace.membership.companyId,
      contactId: body.contactId,
      note: body.note,
      type: body.type,
      valuePaise: body.valuePaise,
    });

    return NextResponse.json({ ok: true, event });
  } catch (error) {
    if (error instanceof CampaignReplyAttributionError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_CONVERSION_ERROR",
          message: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          code: "VALIDATION_ERROR",
          errors: error.flatten().fieldErrors,
          message: "Invalid campaign conversion request",
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
