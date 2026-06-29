import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/server/auth/platform-admin";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { reprocessUnmappedWebhookEvent } from "@/server/services/webhook.service";

const reprocessUnmappedWebhookEventSchema = z.object({
  companyId: z.string().trim().min(1, "Company is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  try {
    const platformAdmin = await requirePlatformAdmin({ request });
    const { eventId } = await params;
    const body: unknown = await request.json();
    const validation = reprocessUnmappedWebhookEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid reprocess details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await reprocessUnmappedWebhookEvent({
      unmappedWebhookEventId: eventId,
      companyId: validation.data.companyId,
    });

    await createPlatformAuditLog({
      actorUserId: platformAdmin.user?.id,
      actorEmail: platformAdmin.email,
      action: "platform.unmapped_webhook.reprocessed",
      entityType: "UnmappedWebhookEvent",
      entityId: result.id,
      metadata: {
        companyId: validation.data.companyId,
        resolvedWebhookEventId: result.resolvedWebhookEventId,
      },
    });

    return NextResponse.json({
      message: "Webhook queued for reprocessing",
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to reprocess webhook";

    return NextResponse.json({ message }, { status: 400 });
  }
}
