import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/authorization";
import {
  attributeInboundCampaignReply,
  CampaignReplyAttributionError,
  getCampaignReplyAttributionDashboard,
} from "@/server/services/campaign-reply-attribution.service";
import { createAuthorizationErrorResponse } from "@/server/utils/api-authorization-error";

const AttributeSchema = z.object({
  inboundMessageId: z.string().min(1),
});

export async function GET(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  const url = new URL(request.url);
  const dashboard = await getCampaignReplyAttributionDashboard({
    campaignId: url.searchParams.get("campaignId"),
    companyId: workspace.membership.companyId,
  });

  return NextResponse.json({ ok: true, ...dashboard });
}

export async function POST(request: Request) {
  let workspace;

  try {
    workspace = await requireAdmin({ request });
  } catch (error) {
    return createAuthorizationErrorResponse(error);
  }

  try {
    const body = AttributeSchema.parse(await request.json());
    const attribution = await attributeInboundCampaignReply({
      companyId: workspace.membership.companyId,
      inboundMessageId: body.inboundMessageId,
    });

    return NextResponse.json({ ok: true, attribution });
  } catch (error) {
    if (error instanceof CampaignReplyAttributionError) {
      return NextResponse.json(
        {
          ok: false,
          code: "CAMPAIGN_REPLY_ATTRIBUTION_ERROR",
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
          message: "Invalid campaign reply attribution request",
        },
        { status: 400 },
      );
    }

    throw error;
  }
}
