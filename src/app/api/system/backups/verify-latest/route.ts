import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { verifyLatestCompletedDatabaseBackup } from "@/server/services/database-backup-verification.service";

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
        { message: "Only owners can verify database backups" },
        { status: 403 },
      );
    }

    const backup = await verifyLatestCompletedDatabaseBackup();

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "system.database_backup.verify_latest",
      entityType: "DatabaseBackupRun",
      entityId: backup.id,
      metadata: {
        fileName: backup.fileName,
        verificationStatus: backup.verificationStatus,
        verifiedAt: backup.verifiedAt?.toISOString(),
      },
    });

    return NextResponse.json({
      message: "Latest database backup verified",
      backup,
    });
  } catch (error) {
    console.error("VERIFY_LATEST_DATABASE_BACKUP_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to verify latest database backup",
      },
      { status: 500 },
    );
  }
}
