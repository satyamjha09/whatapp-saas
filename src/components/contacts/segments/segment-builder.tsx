"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import {
  actionButtonClass,
  fieldClass,
  helperTextClass,
  labelClass,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import { SegmentRuleRow } from "./segment-rule-row";
import { SegmentPreviewCount } from "./segment-preview-count";
import {
  SEGMENT_PRESETS,
  operatorNeedsValue,
  type SegmentRuleDraft,
} from "./segment-fields";

export type SegmentPreviewResult = {
  count: number;
  warnings: string[];
  sampleContacts: Array<{
    id: string;
    name: string | null;
    countryCode: string;
    phoneNumber: string;
    email: string | null;
    optedOut: boolean;
    tags: string[];
  }>;
};

type SegmentBuilderProps = {
  mode: "create" | "edit";
  segmentId?: string;
  initialName?: string;
  initialDescription?: string;
  initialMatchMode?: "ALL" | "ANY";
  initialRules?: SegmentRuleDraft[];
};

function rulesForApi(rules: SegmentRuleDraft[]) {
  return rules.map((rule) => ({
    field: rule.field,
    operator: rule.operator,
    customFieldKey: rule.customFieldKey?.trim() || undefined,
    value: rule.value?.trim() || undefined,
  }));
}

function rulesReadyForPreview(rules: SegmentRuleDraft[]) {
  return rules.every((rule) => {
    if (rule.field === "CUSTOM_FIELD" && !rule.customFieldKey?.trim()) {
      return false;
    }

    return !operatorNeedsValue(rule.operator) || Boolean(rule.value?.trim());
  });
}

export function SegmentBuilder({
  mode,
  segmentId,
  initialName = "",
  initialDescription = "",
  initialMatchMode = "ALL",
  initialRules = [{ field: "OPTED_OUT", operator: "IS_FALSE" }],
}: SegmentBuilderProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [matchMode, setMatchMode] = useState<"ALL" | "ANY">(initialMatchMode);
  const [rules, setRules] = useState<SegmentRuleDraft[]>(initialRules);

  const [preview, setPreview] = useState<SegmentPreviewResult | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPreview = useCallback(async (matchModeArg: "ALL" | "ANY", rulesArg: SegmentRuleDraft[]) => {
    if (!rulesReadyForPreview(rulesArg)) {
      return;
    }

    setIsPreviewing(true);
    setPreviewError("");

    try {
      const response = await fetch("/api/contact-segments/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchMode: matchModeArg,
          rules: rulesForApi(rulesArg),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPreviewError(data.message ?? "Unable to preview segment.");
        setPreview(null);
        return;
      }

      setPreview(data as SegmentPreviewResult);
    } catch {
      setPreviewError("Unable to preview segment.");
    } finally {
      setIsPreviewing(false);
    }
  }, []);

  // Debounced live preview whenever rules change.
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);

    previewTimer.current = setTimeout(() => {
      void runPreview(matchMode, rules);
    }, 600);

    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [matchMode, rules, runPreview]);

  async function save() {
    if (!name.trim()) {
      setError("Segment name is required.");
      return;
    }

    setError("");
    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        matchMode,
        rules: rulesForApi(rules),
      };

      const response = await fetch(
        mode === "create"
          ? "/api/contact-segments"
          : `/api/contact-segments/${segmentId}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to save segment.");
        return;
      }

      router.push(`/dashboard/contacts/segments/${data.segment.id}`);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="segment-name">
              Segment name <span className="text-rose-600">*</span>
            </label>
            <input
              id="segment-name"
              className={fieldClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Delhi leads"
            />
          </div>

          <div>
            <label className={labelClass} htmlFor="segment-description">
              Description
            </label>
            <input
              id="segment-description"
              className={fieldClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <PanelTitle
            title="Conditions"
            description="Contacts enter and leave this segment automatically as their data changes."
          />

          <div className="mt-3 flex items-center gap-2 text-sm text-[#102040]">
            <span>Match</span>
            <select
              aria-label="Match mode"
              className={`${fieldClass} w-auto py-2`}
              value={matchMode}
              onChange={(event) => setMatchMode(event.target.value as "ALL" | "ANY")}
            >
              <option value="ALL">ALL conditions (AND)</option>
              <option value="ANY">ANY condition (OR)</option>
            </select>
          </div>

          <div className="mt-4 grid gap-3">
            {rules.map((rule, index) => (
              <SegmentRuleRow
                key={index}
                rule={rule}
                onChange={(nextRule) =>
                  setRules((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? nextRule : entry,
                    ),
                  )
                }
                onRemove={() =>
                  setRules((current) =>
                    current.filter((_, entryIndex) => entryIndex !== index),
                  )
                }
              />
            ))}

            {rules.length === 0 && (
              <p className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#E7F8EF] p-4 text-sm text-[#526173]">
                No conditions - this segment will include every contact.
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              setRules((current) => [
                ...current,
                { field: "CITY", operator: "EQUALS", value: "" },
              ])
            }
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#128C7E] hover:underline"
          >
            <Plus className="h-4 w-4" /> Add condition
          </button>

          <p className={helperTextClass}>
            Campaign behaviour rules (read / replied / clicked) unlock with campaign
            analytics in a later step.
          </p>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={actionButtonClass("primary")}
            onClick={save}
            disabled={isSaving}
          >
            {isSaving
              ? "Saving..."
              : mode === "create"
                ? "Save segment"
                : "Save changes"}
          </button>
          <button
            type="button"
            className={actionButtonClass("secondary")}
            onClick={() => router.push("/dashboard/contacts/segments")}
            disabled={isSaving}
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="grid content-start gap-4">
        <SegmentPreviewCount
          preview={preview}
          isLoading={isPreviewing}
          error={previewError}
        />

        {mode === "create" && (
          <div className="rounded-2xl border border-[#BFE9D0] bg-white p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#526173]">
              <Sparkles className="h-3.5 w-3.5 text-[#128C7E]" /> Quick presets
            </p>
            <div className="mt-3 grid gap-2">
              {SEGMENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    if (!name.trim()) setName(preset.name);
                    setMatchMode(preset.matchMode);
                    setRules(preset.rules.map((rule) => ({ ...rule })));
                  }}
                  className="rounded-xl border border-[#BFE9D0] px-3 py-2 text-left transition hover:border-[#128C7E]/40 hover:bg-[#E7F8EF]"
                >
                  <span className="block text-sm font-semibold text-[#081B3A]">
                    {preset.name}
                  </span>
                  <span className="block text-xs text-[#526173]">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
