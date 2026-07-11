"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Edit3,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Tag,
  X,
} from "lucide-react";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type ContactActivity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
};

type ContactProfile = {
  id: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  countryCode: string;
  phoneNumber: string;
  city: string | null;
  source: string;
  lifecycleStage: string;
  marketingConsentStatus: string;
  utilityConsentStatus: string;
  optedOutAt: string | null;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  customAttributes: unknown;
  lists: Array<{ id: string; name: string; description: string | null }>;
  tags: string[];
  activities: ContactActivity[];
  _count: {
    messages: number;
    inboxNotes: number;
  };
};

type ContactProfileDrawerProps = {
  contactId: string | null;
  onClose: () => void;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatLabel(value?: string | null) {
  if (!value) return "Unknown";

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function asAttributeRows(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  return Object.entries(value as Record<string, unknown>)
    .filter(([, rowValue]) => rowValue !== null && rowValue !== undefined && rowValue !== "")
    .map(([key, rowValue]) => ({
      key,
      value:
        typeof rowValue === "string" || typeof rowValue === "number" || typeof rowValue === "boolean"
          ? String(rowValue)
          : JSON.stringify(rowValue),
    }));
}

function InfoRow({
  action,
  label,
  value,
}: {
  action?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)_auto] items-start gap-3 py-2 text-sm">
      <span className="text-[#526173]">{label}</span>
      <span className="min-w-0 font-medium text-[#081B3A]">{value}</span>
      {action}
    </div>
  );
}

function Section({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-t border-[#E7F8EF] px-5 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[#081B3A]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ContactProfileDrawer({
  contactId,
  onClose,
}: ContactProfileDrawerProps) {
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!contactId) return;

    let isActive = true;

    async function loadProfile() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/contacts/${contactId}/profile`);
        const data = await response.json();

        if (!isActive) return;

        if (!response.ok) {
          setError(data.message ?? "Unable to load contact profile.");
          setContact(null);
          return;
        }

        setContact(data.contact);
      } catch {
        if (isActive) {
          setError("Unable to load contact profile.");
          setContact(null);
        }
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadProfile();

    return () => {
      isActive = false;
    };
  }, [contactId]);

  const attributeRows = useMemo(
    () => asAttributeRows(contact?.customAttributes),
    [contact?.customAttributes],
  );

  if (!contactId) return null;

  const displayName = contact?.name ?? contact?.phoneNumber ?? "Contact";
  const phone = contact ? `+${contact.countryCode}${contact.phoneNumber}` : "";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#081B3A]/30 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close contact profile"
        className="hidden flex-1 cursor-default md:block"
        onClick={onClose}
      />

      <aside className="flex h-full w-full flex-col bg-white shadow-[-24px_0_60px_rgba(8,27,58,0.18)] md:max-w-[500px]">
        <header className="sticky top-0 z-10 border-b border-[#E7F8EF] bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#BFE9D0] text-[#526173] transition hover:bg-[#F0FBF6] hover:text-[#128C7E]"
                aria-label="Close drawer"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E7F8EF] text-sm font-bold text-[#128C7E]">
                {getInitials(displayName)}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-[#081B3A]">
                  {displayName}
                </h2>
                <p className="text-sm text-[#526173]">
                  {contact?.isBlocked ? "Blocked contact" : "Active contact"}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#526173] transition hover:bg-[#F0FBF6] hover:text-[#128C7E]"
              aria-label="More contact actions"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          {contact ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/dashboard/messages/send?contactId=${contact.id}`}
                className={actionButtonClass()}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Send Message
              </Link>
              <Link
                href={`/dashboard/contacts/${contact.id}/crm`}
                className={actionButtonClass("secondary")}
              >
                <Edit3 className="mr-2 h-4 w-4" />
                Edit Contact
              </Link>
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="px-5 py-10 text-sm text-[#526173]">
              Loading contact profile...
            </div>
          ) : null}

          {error ? (
            <div className="m-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {contact ? (
            <>
              <Section title="Contact Information">
                <div className="divide-y divide-[#F0FBF6]">
                  <InfoRow
                    label="Phone"
                    value={phone}
                    action={
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(phone)}
                        className="text-[#128C7E]"
                        aria-label="Copy phone number"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    }
                  />
                  <InfoRow label="Email" value={contact.email ?? "Not provided"} />
                  <InfoRow label="WhatsApp name" value={contact.name ?? "Not provided"} />
                  <InfoRow label="Company" value={contact.companyName ?? "Not provided"} />
                  <InfoRow label="Source" value={formatLabel(contact.source)} />
                  <InfoRow label="Created" value={formatDate(contact.createdAt)} />
                  <InfoRow label="Last updated" value={formatDate(contact.updatedAt)} />
                  <InfoRow
                    label="Last activity"
                    value={formatDate(contact.lastActivityAt)}
                  />
                </div>
              </Section>

              <Section title="Consent & Status">
                <div className="grid gap-2 text-sm">
                  {[
                    ["Marketing consent", formatLabel(contact.marketingConsentStatus)],
                    ["Utility consent", formatLabel(contact.utilityConsentStatus)],
                    ["Opted out", contact.optedOutAt ? "Yes" : "No"],
                    ["Blocked", contact.isBlocked ? "Yes" : "No"],
                    ["Lifecycle stage", formatLabel(contact.lifecycleStage)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4">
                      <span className="text-[#526173]">{label}</span>
                      <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-xs font-semibold text-[#075E54]">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                title="Labels"
                action={
                  <Link
                    href={`/dashboard/contacts/${contact.id}/crm`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Label
                  </Link>
                }
              >
                {contact.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#075E54]"
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#526173]">No labels added.</p>
                )}
              </Section>

              <Section
                title="Attributes"
                action={
                  <Link
                    href={`/dashboard/contacts/${contact.id}/crm`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Attribute
                  </Link>
                }
              >
                {attributeRows.length > 0 ? (
                  <div className="divide-y divide-[#F0FBF6]">
                    {attributeRows.map((row) => (
                      <InfoRow
                        key={row.key}
                        label={formatLabel(row.key)}
                        value={row.value}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#526173]">No custom attributes added.</p>
                )}
              </Section>

              <Section title="Lists & Segments">
                {contact.lists.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {contact.lists.map((list) => (
                      <span
                        key={list.id}
                        className="rounded-full border border-[#BFE9D0] px-3 py-1 text-xs font-semibold text-[#081B3A]"
                      >
                        {list.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#526173]">
                    No static lists yet. Smart segment membership is calculated when
                    campaigns run.
                  </p>
                )}
              </Section>

              <Section
                title="Addresses"
                action={
                  <Link
                    href="/dashboard/contacts/addresses"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Address
                  </Link>
                }
              >
                <p className="text-sm text-[#526173]">No address added.</p>
              </Section>

              <Section
                title="Recent Activity"
                action={
                  <Link
                    href={`/dashboard/contacts/${contact.id}/timeline`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#128C7E]"
                  >
                    Full timeline
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                }
              >
                {contact.activities.length > 0 ? (
                  <div className="space-y-3">
                    {contact.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-xl border border-[#E7F8EF] bg-[#F8FFFB] p-3"
                      >
                        <div className="flex items-start gap-2">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
                          <div>
                            <p className="text-sm font-semibold text-[#081B3A]">
                              {activity.title}
                            </p>
                            <p className="text-xs text-[#526173]">
                              {formatDate(activity.createdAt)}
                            </p>
                            {activity.description ? (
                              <p className="mt-1 text-sm text-[#526173]">
                                {activity.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#526173]">No recent activity yet.</p>
                )}
              </Section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
