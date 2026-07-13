import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  syncTallyOrdersForCompany,
  TallyOrderSyncError,
} from "@/server/services/tally-order-sync.service";
import { syncTallyOrdersSchema } from "@/server/validators/tally-order-sync.validator";

function canManageOrders(role?: string) {
  return role === "OWNER" || role === "ADMIN";
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

    if (!canManageOrders(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to sync Tally orders" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = syncTallyOrdersSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid Tally sync payload",
        },
        { status: 400 },
      );
    }

    const result = await syncTallyOrdersForCompany(
      context.membership.companyId,
      context.user.id,
      validation.data,
    );

    return NextResponse.json({
      issues: result.issues,
      message: "Tally order sync completed",
      run: result.run,
    });
  } catch (error) {
    console.error("SYNC_TALLY_ORDERS_ERROR:", error);

    if (error instanceof TallyOrderSyncError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to sync Tally orders",
      },
      { status: 500 },
    );
  }
}
