import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { getCustomerJourneySummary } from "@/server/services/customer-journey.service";
import { CustomerJourneyQuerySchema } from "@/server/validators/customer-journey.validator";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 }
      );
    }

    const { contactId } = await params;

    await assertTenantEntityAccess({
      companyId: context.membership.companyId,
      entityType: "Contact",
      entityId: contactId,
    });

    const { searchParams } = new URL(request.url);
    const rawParams = {
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
    };

    const validatedInput = CustomerJourneyQuerySchema.partial().parse(rawParams);

    const summary = await getCustomerJourneySummary(
      context.membership.companyId,
      contactId,
      validatedInput
    );

    return NextResponse.json({ summary });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET_CUSTOMER_JOURNEY_SUMMARY_ERROR:", err);
    return NextResponse.json(
      { message: err.message || "Unable to fetch customer journey summary" },
      { status: 500 }
    );
  }
}
