import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { updateUserProfile } from "@/server/services/auth.service";
import { updateProfileSchema } from "@/server/validators/profile.validator";

export async function PATCH(request: Request) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid profile details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const user = await updateUserProfile(context.user.id, validation.data);

    if (context.membership) {
      await createAuditLog({
        companyId: context.membership.companyId,
        actorUserId: context.user.id,
        action: "user.profile.updated",
        entityType: "User",
        entityId: user.id,
        metadata: {
          name: user.name,
          mobileUpdated: Boolean(user.mobile),
        },
      });
    }

    return NextResponse.json({
      message: "Profile updated successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: user.mobile,
        imageUrl: user.imageUrl,
      },
    });
  } catch (error) {
    console.error("UPDATE_PROFILE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to update profile" },
      { status: 500 },
    );
  }
}
