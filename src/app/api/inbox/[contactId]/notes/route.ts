import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { createInboxNote } from "@/server/services/inbox.service";
import { createInboxNoteSchema } from "@/server/validators/inbox-note.validator";

type CreateInboxNoteRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: CreateInboxNoteRouteContext,
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

    const body: unknown = await request.json();
    const validation = createInboxNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid note",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId } = await params;

    const note = await createInboxNote(
      context.membership.companyId,
      contactId,
      context.user.id,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.note.created",
      entityType: "InboxNote",
      entityId: note.id,
      metadata: {
        contactId,
      },
    });

    return NextResponse.json(
      {
        message: "Note created successfully",
        note,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_INBOX_NOTE_ERROR:", error);

    if (error instanceof Error && error.message === "Contact not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to create note" },
      { status: 500 },
    );
  }
}
