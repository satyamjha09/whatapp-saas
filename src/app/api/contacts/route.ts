import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createContactForCompany,
  getContactsByCompany,
} from "@/server/services/contact.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { createContactSchema } from "@/server/validators/contact.validator";

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

    const contacts = await getContactsByCompany(context.membership.companyId);

    return NextResponse.json({
      contacts,
    });
  } catch (error) {
    console.error("GET_CONTACTS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch contacts" },
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

    const body: unknown = await request.json();

    const validation = createContactSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid contact details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const contact = await createContactForCompany(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Contact created successfully",
        contact,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_CONTACT_ERROR:", error);

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    return NextResponse.json(
      { message: "Unable to create contact" },
      { status: 500 },
    );
  }
}
