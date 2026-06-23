import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";
import { prisma } from "@/lib/prisma";

export const PUBLIC_API_IDEMPOTENCY_RETENTION_JOB =
  "public-api-idempotency-retention";

export async function runPublicApiIdempotencyRetentionJob() {
  const jobRun = await startMaintenanceJobRun(
    PUBLIC_API_IDEMPOTENCY_RETENTION_JOB,
  );

  try {
    const deleted = await prisma.publicApiIdempotencyRecord.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    await completeMaintenanceJobRun({
      jobRunId: jobRun.id,
      checkedCount: deleted.count,
      recoveredCount: deleted.count,
    });
    return { deleted: deleted.count };
  } catch (error) {
    await failMaintenanceJobRun({
      jobRunId: jobRun.id,
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown public API idempotency retention error",
    });
    throw error;
  }
}
