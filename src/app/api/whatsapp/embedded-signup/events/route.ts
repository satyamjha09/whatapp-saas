import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { recordWhatsAppEmbeddedSignupEvent } from "@/server/services/whatsapp-embedded-signup.service";
import { saveWhatsAppEmbeddedSignupEventSchema } from "@/server/validators/whatsapp-embedded-signup.validator";

export async function POST(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Only owners and admins can connect WhatsApp" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const body: unknown = await request.json();
    const validation = saveWhatsAppEmbeddedSignupEventSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid Embedded Signup event",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await recordWhatsAppEmbeddedSignupEvent({
      companyId: context.membership.companyId,
      userId: context.user.id,
      input: validation.data,
    });

    return NextResponse.json({ message: "Event logged" });
  } catch (error) {
    console.error("SAVE_WHATSAPP_EMBEDDED_SIGNUP_EVENT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to save Embedded Signup event" },
      { status: 500 },
    );
  }
}
