import { redirect } from "next/navigation";

export default function InboxSettingsIndexPage() {
  redirect("/dashboard/inbox/settings/queues");
}
