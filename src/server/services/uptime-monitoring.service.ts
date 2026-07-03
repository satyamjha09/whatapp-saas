import { UptimeCheckStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident, resolveIncident } from "@/server/services/incident.service";
import { logger } from "@/server/utils/safe-logger";

function isEnabled() {
  return process.env.UPTIME_MONITORING_ENABLED !== "false";
}

function shouldCreateIncidents() {
  return process.env.UPTIME_MONITORING_AUTO_INCIDENTS !== "false";
}

function defaultTimeoutMs() {
  const parsed = Number(process.env.UPTIME_MONITORING_DEFAULT_TIMEOUT_MS ?? 10000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}

function retentionDays() {
  const parsed = Number(process.env.UPTIME_MONITORING_RETENTION_DAYS ?? 30);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function nowMinusDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function fetchWithTimeout({
  url,
  method,
  timeoutMs,
}: {
  url: string;
  method: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "metawhat-Uptime-Monitor/1.0",
      },
    });

    const latencyMs = Date.now() - startedAt;

    let responseSnippet: string | null = null;

    try {
      const text = await response.text();
      responseSnippet = text.slice(0, 500);
    } catch {
      responseSnippet = null;
    }

    return {
      ok: true as const,
      statusCode: response.status,
      latencyMs,
      responseSnippet,
    };
  } catch (error) {
    return {
      ok: false as const,
      latencyMs: Date.now() - startedAt,
      errorMessage:
        error instanceof Error ? error.message : "Unknown uptime monitor error",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classifyStatus({
  ok,
  statusCode,
  expectedStatus,
  latencyMs,
  timeoutMs,
}: {
  ok: boolean;
  statusCode?: number | null;
  expectedStatus: number;
  latencyMs?: number | null;
  timeoutMs: number;
}): UptimeCheckStatus {
  if (!ok) return "DOWN";
  if (statusCode !== expectedStatus) return "DOWN";
  if (latencyMs && latencyMs > Math.floor(timeoutMs * 0.8)) return "DEGRADED";

  return "UP";
}

export async function createUptimeMonitor({
  name,
  url,
  method = "GET",
  expectedStatus = 200,
  timeoutMs = defaultTimeoutMs(),
  intervalMinutes = 5,
  failureThreshold = 3,
  recoveryThreshold = 2,
}: {
  name: string;
  url: string;
  method?: string;
  expectedStatus?: number;
  timeoutMs?: number;
  intervalMinutes?: number;
  failureThreshold?: number;
  recoveryThreshold?: number;
}) {
  return prisma.uptimeMonitor.create({
    data: {
      name,
      url,
      method,
      expectedStatus,
      timeoutMs,
      intervalMinutes,
      failureThreshold,
      recoveryThreshold,
    },
  });
}

export async function seedDefaultUptimeMonitors() {
  const candidates = [
    {
      name: "Public App",
      url: process.env.UPTIME_MONITOR_PUBLIC_URL,
      expectedStatus: 200,
    },
    {
      name: "Health API",
      url: process.env.UPTIME_MONITOR_HEALTH_URL,
      expectedStatus: 200,
    },
    {
      name: "Deep Health API",
      url: process.env.UPTIME_MONITOR_DEEP_HEALTH_URL,
      expectedStatus: 200,
    },
  ].filter((item): item is { name: string; url: string; expectedStatus: number } =>
    Boolean(item.url),
  );

  const results = [];

  for (const item of candidates) {
    const existing = await prisma.uptimeMonitor.findFirst({
      where: {
        url: item.url,
      },
    });

    if (existing) {
      results.push({
        created: false,
        monitorId: existing.id,
        name: existing.name,
      });
      continue;
    }

    const created = await createUptimeMonitor(item);

    results.push({
      created: true,
      monitorId: created.id,
      name: created.name,
    });
  }

  return results;
}

async function openUptimeIncident({
  monitorId,
  monitorName,
  url,
  status,
  statusCode,
  errorMessage,
  latencyMs,
}: {
  monitorId: string;
  monitorName: string;
  url: string;
  status: UptimeCheckStatus;
  statusCode?: number | null;
  errorMessage?: string | null;
  latencyMs?: number | null;
}) {
  if (!shouldCreateIncidents()) return null;

  const incident = await createIncident({
    title: `Uptime monitor failed: ${monitorName}`,
    description:
      errorMessage ??
      `Monitor ${monitorName} returned ${statusCode ?? "no status"} for ${url}.`,
    source: "SYSTEM",
    severity: status === "DOWN" ? "CRITICAL" : "HIGH",
    idempotencyKey: `uptime-monitor:${monitorId}:open`,
    metadata: {
      monitorId,
      monitorName,
      url,
      status,
      statusCode,
      latencyMs,
      errorMessage,
    },
  });

  return incident;
}

async function resolveUptimeIncident({
  incidentId,
  monitorName,
}: {
  incidentId: string;
  monitorName: string;
}) {
  await resolveIncident({
    incidentId,
    message: `Uptime monitor recovered: ${monitorName}`,
  }).catch((error) => {
    logger.error("Failed to resolve uptime incident", {
      error,
      incidentId,
      monitorName,
    });
  });
}

export async function runUptimeMonitorCheck({
  monitorId,
}: {
  monitorId: string;
}) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Uptime monitoring disabled",
    };
  }

  const monitor = await prisma.uptimeMonitor.findUnique({
    where: {
      id: monitorId,
    },
  });

  if (!monitor || monitor.status !== "ACTIVE") {
    return {
      skipped: true,
      reason: "Monitor not active",
    };
  }

  const result = await fetchWithTimeout({
    url: monitor.url,
    method: monitor.method,
    timeoutMs: monitor.timeoutMs,
  });

  const status = classifyStatus({
    ok: result.ok,
    statusCode: result.ok ? result.statusCode : null,
    expectedStatus: monitor.expectedStatus,
    latencyMs: result.latencyMs,
    timeoutMs: monitor.timeoutMs,
  });

  const check = await prisma.uptimeCheck.create({
    data: {
      monitorId: monitor.id,
      status,
      statusCode: result.ok ? result.statusCode : null,
      latencyMs: result.latencyMs,
      errorMessage: result.ok ? null : result.errorMessage,
      responseSnippet: result.ok ? result.responseSnippet : null,
    },
  });

  const isSuccessful = status === "UP";
  const consecutiveFailures = isSuccessful ? 0 : monitor.consecutiveFailures + 1;
  const consecutiveSuccesses = isSuccessful ? monitor.consecutiveSuccesses + 1 : 0;

  let openIncidentId = monitor.openIncidentId;
  let openIncidentState = monitor.openIncidentState;

  if (
    !isSuccessful &&
    consecutiveFailures >= monitor.failureThreshold &&
    monitor.openIncidentState !== "OPEN"
  ) {
    const incident = await openUptimeIncident({
      monitorId: monitor.id,
      monitorName: monitor.name,
      url: monitor.url,
      status,
      statusCode: result.ok ? result.statusCode : null,
      errorMessage: result.ok ? null : result.errorMessage,
      latencyMs: result.latencyMs,
    });

    openIncidentId = incident?.id ?? openIncidentId;
    openIncidentState = "OPEN";
  }

  if (
    isSuccessful &&
    monitor.openIncidentState === "OPEN" &&
    monitor.openIncidentId &&
    consecutiveSuccesses >= monitor.recoveryThreshold
  ) {
    await resolveUptimeIncident({
      incidentId: monitor.openIncidentId,
      monitorName: monitor.name,
    });

    openIncidentState = "RESOLVED";
  }

  const updated = await prisma.uptimeMonitor.update({
    where: {
      id: monitor.id,
    },
    data: {
      lastStatus: status,
      lastStatusCode: result.ok ? result.statusCode : null,
      lastLatencyMs: result.latencyMs,
      lastCheckedAt: check.checkedAt,
      lastSuccessAt: isSuccessful ? check.checkedAt : monitor.lastSuccessAt,
      lastFailureAt: isSuccessful ? monitor.lastFailureAt : check.checkedAt,
      consecutiveFailures,
      consecutiveSuccesses,
      openIncidentId,
      openIncidentState,
    },
  });

  return {
    skipped: false,
    monitor: updated,
    check,
  };
}

export async function runDueUptimeMonitorChecks() {
  if (!isEnabled()) {
    return {
      skipped: true,
      checked: 0,
    };
  }

  const monitors = await prisma.uptimeMonitor.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        {
          lastCheckedAt: null,
        },
        {
          lastCheckedAt: {
            lt: new Date(Date.now() - 60 * 1000),
          },
        },
      ],
    },
    orderBy: {
      lastCheckedAt: "asc",
    },
    take: 50,
  });

  const dueMonitors = monitors.filter((monitor) => {
    if (!monitor.lastCheckedAt) return true;

    const nextDueAt =
      monitor.lastCheckedAt.getTime() + monitor.intervalMinutes * 60 * 1000;

    return nextDueAt <= Date.now();
  });

  const results = [];

  for (const monitor of dueMonitors) {
    results.push(
      await runUptimeMonitorCheck({
        monitorId: monitor.id,
      }),
    );
  }

  return {
    skipped: false,
    checked: results.length,
    results,
  };
}

export async function getUptimeMonitoringHealth() {
  const [
    activeMonitors,
    downMonitors,
    degradedMonitors,
    openIncidentMonitors,
    checks24h,
    failedChecks24h,
  ] = await Promise.all([
    prisma.uptimeMonitor.count({
      where: {
        status: "ACTIVE",
      },
    }),
    prisma.uptimeMonitor.count({
      where: {
        lastStatus: "DOWN",
        status: "ACTIVE",
      },
    }),
    prisma.uptimeMonitor.count({
      where: {
        lastStatus: "DEGRADED",
        status: "ACTIVE",
      },
    }),
    prisma.uptimeMonitor.count({
      where: {
        openIncidentState: "OPEN",
      },
    }),
    prisma.uptimeCheck.count({
      where: {
        checkedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.uptimeCheck.count({
      where: {
        status: {
          in: ["DOWN", "DEGRADED"],
        },
        checkedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    isHealthy:
      isEnabled() &&
      activeMonitors > 0 &&
      downMonitors === 0 &&
      openIncidentMonitors === 0,
    activeMonitors,
    downMonitors,
    degradedMonitors,
    openIncidentMonitors,
    checks24h,
    failedChecks24h,
  };
}

export async function listUptimeMonitors() {
  return prisma.uptimeMonitor.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      checks: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 10,
      },
    },
  });
}

export async function getUptimeMonitorDetail(monitorId: string) {
  return prisma.uptimeMonitor.findUnique({
    where: {
      id: monitorId,
    },
    include: {
      checks: {
        orderBy: {
          checkedAt: "desc",
        },
        take: 200,
      },
    },
  });
}

export async function cleanupOldUptimeChecks() {
  return prisma.uptimeCheck.deleteMany({
    where: {
      checkedAt: {
        lt: nowMinusDays(retentionDays()),
      },
    },
  });
}
