import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  deleteInboxNote,
  updateInboxNote,
} from "@/server/services/inbox.service";
import { updateInboxNoteSchema } from "@/server/validators/inbox-note.validator";

type InboxNoteRouteContext = {
  params: Promise<{
    contactId: string;
    noteId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: InboxNoteRouteContext,
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
    const validation = updateInboxNoteSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid note",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId, noteId } = await params;

    const note = await updateInboxNote(
      context.membership.companyId,
      contactId,
      noteId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.note.updated",
      entityType: "InboxNote",
      entityId: note.id,
      metadata: {
        contactId,
      },
    });

    return NextResponse.json({
      message: "Note updated successfully",
      note,
    });
  } catch (error) {
    console.error("UPDATE_INBOX_NOTE_ERROR:", error);

    if (error instanceof Error && error.message === "Note not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to update note" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: InboxNoteRouteContext,
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

    const { contactId, noteId } = await params;

    const note = await deleteInboxNote(
      context.membership.companyId,
      contactId,
      noteId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.note.deleted",
      entityType: "InboxNote",
      entityId: note.id,
      metadata: {
        contactId,
      },
    });

    return NextResponse.json({
      message: "Note deleted successfully",
    });
  } catch (error) {
    console.error("DELETE_INBOX_NOTE_ERROR:", error);

    if (error instanceof Error && error.message === "Note not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to delete note" },
      { status: 500 },
    );
  }
}
