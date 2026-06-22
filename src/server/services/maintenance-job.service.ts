import { prisma } from "@/lib/prisma";

export function startMaintenanceJobRun(
  jobName: string,
  companyId?: string,
) {
  return prisma.maintenanceJobRun.create({
    data: { jobName, companyId },
  });
}

export function completeMaintenanceJobRun({
  checkedCount,
  jobRunId,
  recoveredCount,
}: {
  checkedCount: number;
  jobRunId: string;
  recoveredCount: number;
}) {
  return prisma.maintenanceJobRun.update({
    where: { id: jobRunId },
    data: {
      status: "COMPLETED",
      checkedCount,
      recoveredCount,
      completedAt: new Date(),
    },
  });
}

export function failMaintenanceJobRun({
  errorMessage,
  jobRunId,
}: {
  errorMessage: string;
  jobRunId: string;
}) {
  return prisma.maintenanceJobRun.update({
    where: { id: jobRunId },
    data: {
      status: "FAILED",
      errorMessage,
      completedAt: new Date(),
    },
  });
}

export function getRecentMaintenanceJobRuns(
  jobName: string,
  companyId: string,
) {
  return prisma.maintenanceJobRun.findMany({
    where: { jobName, companyId },
    orderBy: { startedAt: "desc" },
    take: 25,
  });
}
