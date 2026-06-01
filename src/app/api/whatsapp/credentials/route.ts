import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { saveWhatsAppCredentialsForCompany } from "@/server/services/whatsapp.service";
import { saveWhatsAppCredentialsSchema } from "@/server/validators/whatsapp.validator";

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
        { message: "You do not have permission to save WhatsApp credentials" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = saveWhatsAppCredentialsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid WhatsApp credentials",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const account = await saveWhatsAppCredentialsForCompany(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json({
      message: "WhatsApp credentials saved successfully",
      account,
    });
  } catch (error) {
    console.error("SAVE_WHATSAPP_CREDENTIALS_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "WhatsApp account setup not found"
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to save WhatsApp credentials" },
      { status: 500 },
    );
  }
}
