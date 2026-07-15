import { prisma } from "@/lib/prisma";

const DEFAULT_START_MINUTE = 9 * 60;
const DEFAULT_END_MINUTE = 18 * 60;
const MAX_MINUTE_STEPS = 60 * 24 * 120;

type BusinessWindow = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

function normalizeDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultWindows(): BusinessWindow[] {
  return [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startMinute: DEFAULT_START_MINUTE,
    endMinute: DEFAULT_END_MINUTE,
  }));
}

export async function getActiveBusinessHours(input: {
  companyId: string;
  queueId?: string | null;
}) {
  const configured = await prisma.inboxBusinessHours.findFirst({
    where: {
      companyId: input.companyId,
      active: true,
      OR: [
        ...(input.queueId ? [{ queueId: input.queueId }] : []),
        { queueId: null },
      ],
    },
    include: {
      windows: {
        where: { active: true },
        orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
      },
    },
    orderBy: [{ queueId: "desc" }, { createdAt: "asc" }],
  });

  return {
    timezone: configured?.timezone ?? "Asia/Kolkata",
    windows: configured?.windows.length
      ? configured.windows.map((window) => ({
          dayOfWeek: window.dayOfWeek,
          startMinute: window.startMinute,
          endMinute: window.endMinute,
        }))
      : defaultWindows(),
  };
}

export async function listInboxBusinessHours(companyId: string) {
  return prisma.inboxBusinessHours.findMany({
    where: { companyId },
    include: {
      queue: { select: { id: true, name: true } },
      windows: { orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }] },
    },
    orderBy: [{ queueId: "asc" }, { createdAt: "asc" }],
  });
}

export async function listInboxHolidays(companyId: string) {
  return prisma.inboxHoliday.findMany({
    where: { companyId, active: true },
    orderBy: { date: "asc" },
  });
}

function isInsideBusinessWindow(date: Date, windows: BusinessWindow[]) {
  const dayOfWeek = date.getDay();
  const minuteOfDay = date.getHours() * 60 + date.getMinutes();

  return windows.some(
    (window) =>
      window.dayOfWeek === dayOfWeek &&
      minuteOfDay >= window.startMinute &&
      minuteOfDay < window.endMinute,
  );
}

export async function addBusinessMinutes(input: {
  companyId: string;
  queueId?: string | null;
  from: Date;
  minutes: number;
}) {
  if (input.minutes <= 0) {
    return input.from;
  }

  const [{ windows }, holidays] = await Promise.all([
    getActiveBusinessHours({
      companyId: input.companyId,
      queueId: input.queueId,
    }),
    listInboxHolidays(input.companyId),
  ]);
  const holidayKeys = new Set(holidays.map((holiday) => normalizeDateKey(holiday.date)));

  let cursor = new Date(input.from);
  cursor.setSeconds(0, 0);
  let remaining = input.minutes;
  let guard = 0;

  while (remaining > 0 && guard < MAX_MINUTE_STEPS) {
    cursor = new Date(cursor.getTime() + 60 * 1000);
    guard += 1;

    if (holidayKeys.has(normalizeDateKey(cursor))) {
      continue;
    }

    if (!isInsideBusinessWindow(cursor, windows)) {
      continue;
    }

    remaining -= 1;
  }

  return cursor;
}
