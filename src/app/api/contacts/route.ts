import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createContactForCompany,
  getContactsByCompany,
  listContactsFiltered,
} from "@/server/services/contact.service";
import { ContactSegmentBuilderError } from "@/server/services/contact-segment-builder.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { createContactSchema } from "@/server/validators/contact.validator";
import { ContactsListQuerySchema } from "@/server/validators/contact-segment.validator";

const FILTER_PARAMS = [
  "search",
  "listId",
  "segmentId",
  "tag",
  "optedOut",
  "page",
  "pageSize",
] as const;

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const hasFilters = FILTER_PARAMS.some((param) =>
      url.searchParams.has(param),
    );

    if (!hasFilters) {
      // Backwards-compatible unfiltered response.
      const contacts = await getContactsByCompany(context.membership.companyId);

      return NextResponse.json({
        contacts,
      });
    }

    const query = ContactsListQuerySchema.parse(
      Object.fromEntries(
        FILTER_PARAMS.map((param) => [
          param,
          url.searchParams.get(param) ?? undefined,
        ]).filter(([, value]) => value !== undefined),
      ),
    );

    const result = await listContactsFiltered(
      context.membership.companyId,
      query,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ContactSegmentBuilderError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

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
