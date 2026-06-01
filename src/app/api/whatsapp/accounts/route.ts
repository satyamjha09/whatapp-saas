import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createWhatsAppAccountForCompany,
  getWhatsAppAccountByCompany,
} from "@/server/services/whatsapp.service";
import { createWhatsAppAccountSchema } from "@/server/validators/whatsapp.validator";

export async function GET() {
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

    const account = await getWhatsAppAccountByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({
      account,
    });
  } catch (error) {
    console.error("GET_WHATSAPP_ACCOUNT_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch WhatsApp account" },
      { status: 500 },
    );
  }
}

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
        { message: "You do not have permission to connect WhatsApp" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();

    const validation = createWhatsAppAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid WhatsApp account details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const account = await createWhatsAppAccountForCompany(
      context.membership.companyId,
      validation.data.businessName,
    );

    return NextResponse.json(
      {
        message: "WhatsApp account setup started",
        account,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_WHATSAPP_ACCOUNT_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "Company already has a WhatsApp account setup"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { message: "Unable to start WhatsApp account setup" },
      { status: 500 },
    );
  }
}
