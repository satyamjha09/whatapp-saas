import { Bell } from "lucide-react";
import Link from "next/link";
import { getUnreadCompanyNotificationCount } from "@/server/services/company-notification.service";

export default async function NotificationBadge({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  const unreadCount = await getUnreadCompanyNotificationCount({
    companyId,
    userId,
  });

  return (
    <Link
      href="/dashboard/notifications"
      className="relative grid h-10 w-10 place-items-center rounded-lg border border-[#D8E6F3] bg-white text-[#526173] transition hover:bg-[#F0F8FF] hover:text-[#0052CC]"
      title="Notifications"
      aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 ? (
        <span className="absolute -right-2 -top-2 min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-4 text-white ring-2 ring-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
