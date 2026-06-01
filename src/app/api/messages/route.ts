import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getMessagesByCompany } from "@/server/services/message.service";

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

    const messages = await getMessagesByCompany(context.membership.companyId);

    return NextResponse.json({
      messages,
    });
  } catch (error) {
    console.error("GET_MESSAGES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch messages" },
      { status: 500 },
    );
  }
}
