import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  Panel,
  actionButtonClass,
} from "@/app/dashboard/dashboard-ui";

export default function WhatsAppConnectionRequiredCard() {
  return (
    <Panel>
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#081B3A]">
            Connect WhatsApp first
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
            This workspace needs a connected WhatsApp Business Account and phone
            number before messages can be queued.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/whatsapp/connect"
            className={actionButtonClass()}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Connect WhatsApp
          </Link>
          <Link
            href="/dashboard/whatsapp"
            className={actionButtonClass("secondary")}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Connected Accounts
          </Link>
        </div>
      </div>
    </Panel>
  );
}
