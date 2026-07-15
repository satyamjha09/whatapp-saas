import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  listInboxBusinessHours,
  listInboxHolidays,
} from "@/server/services/inbox-business-hours.service";

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minuteLabel(minute: number) {
  const hours = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minute % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default async function InboxBusinessHoursSettingsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [businessHours, holidays] = await Promise.all([
    listInboxBusinessHours(companyId),
    listInboxHolidays(companyId),
  ]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#128C7E]">
          Business hours
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#081B3A]">
          Working windows
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
          SLA deadlines are calculated only inside active working windows. Queue
          hours override the company default when present.
        </p>

        {businessHours.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[#BFE9D0] bg-[#F7FFFA] p-8 text-center">
            <h3 className="text-lg font-black text-[#081B3A]">
              Weekday defaults are active
            </h3>
            <p className="mt-2 text-sm text-[#526173]">
              New SLA timers use Monday-Friday, 09:00-18:00 until custom hours are
              configured.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {businessHours.map((hours) => (
              <article
                key={hours.id}
                className="rounded-2xl border border-[#E0F3E8] bg-[#F7FFFA] p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-black text-[#081B3A]">
                      {hours.name}
                    </h3>
                    <p className="text-sm text-[#526173]">
                      {hours.queue?.name ?? "Company default"} · {hours.timezone}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#128C7E]">
                    {hours.active ? "Active" : "Disabled"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {hours.windows.map((window) => (
                    <span
                      key={window.id}
                      className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#526173]"
                    >
                      {dayLabels[window.dayOfWeek]} {minuteLabel(window.startMinute)}
                      -{minuteLabel(window.endMinute)}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#BFE9D0] bg-white p-6 shadow-[0_18px_50px_rgba(18,140,126,0.06)]">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#128C7E]">
          Holidays
        </p>
        <h2 className="mt-2 text-xl font-black text-[#081B3A]">
          SLA pause days
        </h2>
        {holidays.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-[#526173]">
            No holidays configured. SLA timers currently follow only the active
            business-hour windows.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="rounded-xl border border-[#E0F3E8] bg-[#F7FFFA] p-4"
              >
                <p className="font-bold text-[#081B3A]">{holiday.name}</p>
                <p className="text-sm text-[#526173]">
                  {holiday.date.toLocaleDateString("en-IN")} · {holiday.timezone}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
