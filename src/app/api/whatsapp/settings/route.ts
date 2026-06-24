import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  getWhatsAppSettingsByCompany,
  updateWhatsAppSettings,
} from "@/server/services/whatsapp-settings.service";
import { updateWhatsAppSettingsSchema } from "@/server/validators/whatsapp-settings.validator";
import { assertRoutePermission, createRoutePermissionErrorResponse } from "@/server/auth/route-permission-guard";

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

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const settings = await getWhatsAppSettingsByCompany(
      context.membership.companyId,
    );

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET_WHATSAPP_SETTINGS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch WhatsApp settings" },
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
        { message: "Only owners and admins can update WhatsApp settings" },
        { status: 403 },
      );
    }

    try {
      await assertRoutePermission({ request, workspace: context });
    } catch (error) {
      return createRoutePermissionErrorResponse(error);
    }

    const body: unknown = await request.json();
    const validation = updateWhatsAppSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid WhatsApp settings",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const settings = await updateWhatsAppSettings(
      context.membership.companyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "whatsapp.settings.updated",
      entityType: "WhatsAppAccount",
      entityId: settings.accountId,
      metadata: {
        wabaId: settings.wabaId,
        phoneNumberId: settings.phoneNumberId,
        displayPhoneNumber: settings.displayPhoneNumber,
        accessTokenUpdated: Boolean(validation.data.accessToken),
      },
    });

    return NextResponse.json({
      message: "WhatsApp settings saved successfully",
      settings,
    });
  } catch (error) {
    console.error("UPDATE_WHATSAPP_SETTINGS_ERROR:", error);

    const knownErrors = [
      "Access token is required for first setup",
      "WABA ID is already connected to another workspace",
      "Phone Number ID is already connected to another workspace",
    ];

    if (error instanceof Error && knownErrors.includes(error.message)) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    return NextResponse.json(
      { message: "Unable to update WhatsApp settings" },
      { status: 500 },
    );
  }
}
