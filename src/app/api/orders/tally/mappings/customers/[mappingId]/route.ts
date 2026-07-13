import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  TallyMappingError,
  updateTallyCustomerMappingForCompany,
} from "@/server/services/tally-order-mapping.service";
import { updateTallyCustomerMappingSchema } from "@/server/validators/tally-order-sync.validator";

function canManageOrders(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ mappingId: string }> },
) {
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

    if (!canManageOrders(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to update mappings" },
        { status: 403 },
      );
    }

    const { mappingId } = await params;
    const body: unknown = await request.json();
    const validation = updateTallyCustomerMappingSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { errors: validation.error.flatten().fieldErrors, message: "Invalid mapping" },
        { status: 400 },
      );
    }

    const mapping = await updateTallyCustomerMappingForCompany(
      context.membership.companyId,
      context.user.id,
      mappingId,
      validation.data,
    );

    return NextResponse.json({ mapping, message: "Customer mapping updated" });
  } catch (error) {
    console.error("UPDATE_TALLY_CUSTOMER_MAPPING_ERROR:", error);

    if (error instanceof TallyMappingError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to update customer mapping",
      },
      { status: 500 },
    );
  }
}
