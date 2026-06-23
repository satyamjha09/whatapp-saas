import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  cleanupOldDatabaseBackups,
  createDatabaseBackup,
} from "@/server/services/database-backup.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
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

    if (context.membership.role !== "OWNER") {
      return NextResponse.json(
        { message: "Only owners can run database backups" },
        { status: 403 },
      );
    }

    const backup = await createDatabaseBackup();
    const cleanup = await cleanupOldDatabaseBackups();

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "system.database_backup.run",
      entityType: "DatabaseBackupRun",
      entityId: backup.id,
      metadata: {
        fileName: backup.fileName,
        sizeBytes: backup.sizeBytes,
        checksumSha256: backup.checksumSha256,
        cleanup,
      },
    });

    return NextResponse.json({
      message: "Database backup completed",
      backup,
      cleanup,
    });
  } catch (error) {
    console.error("MANUAL_DATABASE_BACKUP_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to run database backup",
      },
      { status: 500 },
    );
  }
}
