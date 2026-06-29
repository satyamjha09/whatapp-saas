"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Preset =
  | "READ_NOT_REPLIED"
  | "DELIVERED_NOT_READ"
  | "FAILED"
  | "REPLIED"
  | "NOT_REPLIED";

type Preview = {
  count: number;
  preset: Preset;
  presetLabel: string;
};

const PRESETS: Array<{ description: string; label: string; value: Preset }> = [
  {
    description: "Contacts who opened the message but did not reply.",
    label: "Read, no reply",
    value: "READ_NOT_REPLIED",
  },
  {
    description: "Contacts with delivered messages that have not reached read.",
    label: "Delivered, unread",
    value: "DELIVERED_NOT_READ",
  },
  {
    description: "Contacts whose campaign message failed or was not delivered.",
    label: "Failed",
    value: "FAILED",
  },
  {
    description: "Contacts who replied to this campaign.",
    label: "Replied",
    value: "REPLIED",
  },
  {
    description: "Contacts who were sent, delivered, or read but did not reply.",
    label: "No reply",
    value: "NOT_REPLIED",
  },
];

type CampaignRetargetingCardProps = {
  campaignId: string;
  canManage: boolean;
};

export default function CampaignRetargetingCard({
  campaignId,
  canManage,
}: CampaignRetargetingCardProps) {
  const router = useRouter();
  const [selectedPreset, setSelectedPreset] =
    useState<Preset>("READ_NOT_REPLIED");
  const [previews, setPreviews] = useState<Partial<Record<Preset, Preview>>>(
    {},
  );
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(true);

  const selectedPreview = previews[selectedPreset];

  const selectedLabel = useMemo(
    () =>
      PRESETS.find((preset) => preset.value === selectedPreset)?.label ??
      "Retargeting segment",
    [selectedPreset],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadPreviews() {
      setIsLoadingPreview(true);
      setError("");

      try {
        const results = await Promise.all(
          PRESETS.map(async (preset) => {
            const response = await fetch(
              `/api/campaigns/${campaignId}/retarget/preview`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ preset: preset.value }),
              },
            );
            const data = await response.json();

            if (!response.ok) {
              throw new Error(
                data.message ?? "Unable to preview retargeting audience",
              );
            }

            return [preset.value, data as Preview] as const;
          }),
        );

        if (isMounted) {
          setPreviews(Object.fromEntries(results));
        }
      } catch (previewError) {
        if (isMounted) {
          setError(
            previewError instanceof Error
              ? previewError.message
              : "Unable to preview retargeting audience",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadPreviews();

    return () => {
      isMounted = false;
    };
  }, [campaignId]);

  async function createSegment() {
    setError("");
    setIsCreating(true);

    try {
      const response = await fetch(`/api/campaigns/${campaignId}/retarget`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          preset: selectedPreset,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Unable to create retargeting segment");
      }

      router.push(`/dashboard/messages/bulk?segmentId=${data.segment.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Unable to create retargeting segment",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Retarget this campaign
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Create a reusable contact segment from this campaign&apos;s
            delivery and reply outcome.
          </p>
        </div>

        <button
          type="button"
          onClick={createSegment}
          disabled={!canManage || isCreating || isLoadingPreview}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isCreating ? "Creating..." : "Create segment"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {PRESETS.map((preset) => {
          const preview = previews[preset.value];
          const isSelected = selectedPreset === preset.value;

          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => setSelectedPreset(preset.value)}
              className={`rounded-xl border p-4 text-left transition ${
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-blue-200"
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">
                {preset.label}
              </p>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {isLoadingPreview
                  ? "..."
                  : (preview?.count ?? 0).toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                {preset.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-sm text-gray-600">
        Selected:{" "}
        <span className="font-semibold text-gray-900">{selectedLabel}</span>
        {" - "}
        {(selectedPreview?.count ?? 0).toLocaleString("en-IN")} eligible
        contacts. Blocked contacts and revoked marketing consent are excluded.
      </div>

      {!canManage ? (
        <p className="mt-3 text-sm text-amber-700">
          Only owners and admins can create retargeting segments.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </section>
  );
}
