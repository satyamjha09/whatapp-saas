import {
  StatusPageComponentStatus,
  StatusPageIncidentImpact,
  StatusPageIncidentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident } from "@/server/services/incident.service";

export function isStatusPageEnabled() {
  return process.env.STATUS_PAGE_ENABLED !== "false";
}

export function getDefaultStatusPageSlug() {
  return process.env.STATUS_PAGE_PUBLIC_SLUG || "metawhat";
}

function brandName() {
  return process.env.STATUS_PAGE_BRAND_NAME || "metawhat Status";
}

function supportEmail() {
  return process.env.STATUS_PAGE_SUPPORT_EMAIL || null;
}

function shouldAutoSyncUptime() {
  return process.env.STATUS_PAGE_AUTO_SYNC_UPTIME !== "false";
}

export async function seedDefaultStatusPage() {
  const slug = getDefaultStatusPageSlug();

  const page = await prisma.statusPage.upsert({
    where: {
      slug,
    },
    create: {
      slug,
      name: brandName(),
      supportEmail: supportEmail(),
      isDefault: true,
      visibility: "PUBLIC",
      description:
        "Current system status for metawhat messaging, APIs, webhooks, and dashboard.",
      components: {
        create: [
          {
            name: "Dashboard",
            description: "metawhat web dashboard",
            sortOrder: 1,
          },
          {
            name: "Public API",
            description: "Customer-facing API endpoints",
            sortOrder: 2,
          },
          {
            name: "WhatsApp Webhooks",
            description: "Inbound and status webhook processing",
            sortOrder: 3,
          },
          {
            name: "Background Workers",
            description: "Messaging, campaigns, notifications, and maintenance jobs",
            sortOrder: 4,
          },
        ],
      },
    },
    update: {
      name: brandName(),
      supportEmail: supportEmail(),
      isDefault: true,
      visibility: "PUBLIC",
    },
    include: {
      components: true,
    },
  });

  return page;
}

export async function getPublicStatusPage(slug = getDefaultStatusPageSlug()) {
  if (!isStatusPageEnabled()) {
    return null;
  }

  return prisma.statusPage.findFirst({
    where: {
      slug,
      visibility: "PUBLIC",
    },
    include: {
      components: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      incidents: {
        where: {
          OR: [
            {
              resolvedAt: null,
            },
            {
              resolvedAt: {
                gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              },
            },
          ],
        },
        orderBy: {
          startedAt: "desc",
        },
        include: {
          updates: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });
}

export async function getDefaultStatusPageForAdmin() {
  return prisma.statusPage.findFirst({
    where: {
      slug: getDefaultStatusPageSlug(),
    },
    include: {
      components: {
        orderBy: {
          sortOrder: "asc",
        },
      },
      incidents: {
        orderBy: {
          startedAt: "desc",
        },
        take: 50,
        include: {
          updates: {
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
        },
      },
    },
  });
}

function componentStatusFromMonitor(status?: string | null): StatusPageComponentStatus {
  if (status === "UP") return "OPERATIONAL";
  if (status === "DEGRADED") return "DEGRADED";
  if (status === "DOWN") return "MAJOR_OUTAGE";

  return "OPERATIONAL";
}

export async function syncStatusPageComponentsFromUptime() {
  if (!shouldAutoSyncUptime()) {
    return {
      skipped: true,
      reason: "Status page uptime sync disabled",
    };
  }

  const page = await prisma.statusPage.findFirst({
    where: {
      slug: getDefaultStatusPageSlug(),
    },
    include: {
      components: true,
    },
  });

  if (!page) {
    return {
      skipped: true,
      reason: "Status page not found",
    };
  }

  const monitors = await prisma.uptimeMonitor.findMany({
    where: {
      status: "ACTIVE",
    },
  });

  let synced = 0;

  for (const monitor of monitors) {
    const component = page.components.find(
      (item) =>
        item.uptimeMonitorId === monitor.id ||
        item.name.toLowerCase() === monitor.name.toLowerCase(),
    );

    if (!component) continue;

    await prisma.statusPageComponent.update({
      where: {
        id: component.id,
      },
      data: {
        uptimeMonitorId: monitor.id,
        status: componentStatusFromMonitor(monitor.lastStatus),
        lastCheckedAt: monitor.lastCheckedAt,
        lastSyncedAt: new Date(),
      },
    });

    synced += 1;
  }

  return {
    skipped: false,
    synced,
  };
}

export async function createStatusPageIncident({
  title,
  body,
  impact = "MINOR",
  status = "INVESTIGATING",
  createdByUserId,
}: {
  title: string;
  body?: string | null;
  impact?: StatusPageIncidentImpact;
  status?: StatusPageIncidentStatus;
  createdByUserId?: string | null;
}) {
  const page =
    (await getDefaultStatusPageForAdmin()) ?? (await seedDefaultStatusPage());

  const incident = await prisma.statusPageIncident.create({
    data: {
      statusPageId: page.id,
      title,
      body: body ?? null,
      impact,
      status,
      createdByUserId: createdByUserId ?? null,
      updates: {
        create: {
          status,
          message: body ?? title,
          createdByUserId: createdByUserId ?? null,
        },
      },
    },
    include: {
      updates: true,
    },
  });

  if (impact === "MAJOR" || impact === "CRITICAL") {
    await createIncident({
      title: `Public status incident: ${title}`,
      description: body ?? title,
      source: "PLATFORM",
      severity: impact === "CRITICAL" ? "CRITICAL" : "HIGH",
      idempotencyKey: `status-page-incident:${incident.id}`,
      metadata: {
        statusPageIncidentId: incident.id,
        impact,
        status,
      },
    }).catch(() => undefined);
  }

  return incident;
}

export async function updateStatusPageIncident({
  incidentId,
  status,
  message,
  actorUserId,
}: {
  incidentId: string;
  status: StatusPageIncidentStatus;
  message: string;
  actorUserId?: string | null;
}) {
  const resolvedAt =
    status === "RESOLVED" || status === "COMPLETED" ? new Date() : undefined;

  return prisma.statusPageIncident.update({
    where: {
      id: incidentId,
    },
    data: {
      status,
      resolvedAt,
      updatedByUserId: actorUserId ?? null,
      updates: {
        create: {
          status,
          message,
          createdByUserId: actorUserId ?? null,
        },
      },
    },
    include: {
      updates: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function updateStatusPageComponent({
  componentId,
  status,
}: {
  componentId: string;
  status: StatusPageComponentStatus;
}) {
  return prisma.statusPageComponent.update({
    where: {
      id: componentId,
    },
    data: {
      status,
      lastSyncedAt: new Date(),
    },
  });
}

export async function getStatusPageHealth() {
  const [page, activeIncidents, degradedComponents, outageComponents] =
    await Promise.all([
      prisma.statusPage.findFirst({
        where: {
          slug: getDefaultStatusPageSlug(),
        },
      }),
      prisma.statusPageIncident.count({
        where: {
          resolvedAt: null,
        },
      }),
      prisma.statusPageComponent.count({
        where: {
          status: "DEGRADED",
        },
      }),
      prisma.statusPageComponent.count({
        where: {
          status: {
            in: ["PARTIAL_OUTAGE", "MAJOR_OUTAGE"],
          },
        },
      }),
    ]);

  return {
    enabled: isStatusPageEnabled(),
    configured: Boolean(page),
    activeIncidents,
    degradedComponents,
    outageComponents,
    publicSlug: getDefaultStatusPageSlug(),
    isHealthy:
      isStatusPageEnabled() &&
      Boolean(page) &&
      activeIncidents === 0 &&
      outageComponents === 0,
  };
}
