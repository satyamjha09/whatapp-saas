import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import {
  getInboxCsatSettings,
  updateInboxCsatSettings,
} from "@/server/services/inbox-csat.service";
import { inboxCsatSettingsSchema } from "@/server/validators/inbox-csat.validator";

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

    await assertRoutePermission({ request, workspace: context });

    const settings = await getInboxCsatSettings(context.membership.companyId);

    return NextResponse.json({ settings });
  } catch (error) {
    return createRoutePermissionErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
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

    await assertRoutePermission({ request, workspace: context });

    const body: unknown = await request.json();
    const validation = inboxCsatSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid CSAT settings",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const settings = await updateInboxCsatSettings(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json({ message: "CSAT settings saved", settings });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to save CSAT settings" },
      { status: 500 },
    );
  }
}
