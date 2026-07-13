import { redirect } from "next/navigation";

export default function BroadcastFailuresPage() {
  redirect("/dashboard/campaigns/failures");
}
