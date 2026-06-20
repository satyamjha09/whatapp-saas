import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getProductionChecklistSettingsByCompany,
  updateProductionChecklistSettings,
} from "@/server/services/production-checklist.service";
import { updateProductionChecklistSettingsSchema } from "@/server/validators/production-checklist.validator";

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

    const settings = await getProductionChecklistSettingsByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET_PRODUCTION_CHECKLIST_SETTINGS_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to fetch production checklist settings" },
      { status: 500 },
    );
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

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Only owners and admins can update production checklist" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = updateProductionChecklistSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid production checklist settings",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const settings = await updateProductionChecklistSettings(
      context.membership.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "production_checklist.settings.updated",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        metaPaymentMethodAdded: validation.data.metaPaymentMethodAdded,
        metaBusinessVerificationStatus:
          validation.data.metaBusinessVerificationStatus,
        notesUpdated: validation.data.productionChecklistNotes !== undefined,
      },
    });

    return NextResponse.json({
      message: "Production checklist settings updated successfully",
      settings,
    });
  } catch (error) {
    console.error("UPDATE_PRODUCTION_CHECKLIST_SETTINGS_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to update production checklist settings" },
      { status: 500 },
    );
  }
}
