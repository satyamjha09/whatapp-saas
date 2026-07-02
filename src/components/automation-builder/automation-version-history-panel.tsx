"use client";

import { useEffect, useState } from "react";
import { Clock3, Eye, RotateCcw, X } from "lucide-react";
import type { AutomationGraph } from "@/components/automation-builder/types";

export type AutomationVersionSummary = {
  id: string;
  isCurrentPublished: boolean;
  isRollback: boolean;
  publishedAt: string;
  publishedByUserId: string | null;
  publishNotes: string | null;
  validationSummary: {
    errorCount: number;
    warningCount: number;
  };
  versionNumber: number;
};

export type AutomationRollbackResult = {
  flow: {
    id: string;
    publishedAt: string | null;
    publishedVersionId: string | null;
    status: "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
  };
  graph: AutomationGraph;
  version: {
    id: string;
    publishedAt: string;
    publishNotes: string | null;
    versionNumber: number;
  };
};

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Request failed",
    );
  }

  return data;
}

export default function AutomationVersionHistoryPanel({
  flowId,
  isOpen,
  onClose,
  onRollback,
}: {
  flowId: string;
  isOpen: boolean;
  onClose: () => void;
  onRollback: (result: AutomationRollbackResult) => void;
}) {
  const [versions, setVersions] = useState<AutomationVersionSummary[]>([]);
  const [previewGraph, setPreviewGraph] = useState<AutomationGraph | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [rollbackTarget, setRollbackTarget] =
    useState<AutomationVersionSummary | null>(null);
  const [rollbackNotes, setRollbackNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function loadVersions() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await readJson(
          await fetch(`/api/automation/flows/${encodeURIComponent(flowId)}/versions`),
        );

        if (!cancelled) {
          setVersions(data.versions ?? []);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load version history",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadVersions();

    return () => {
      cancelled = true;
    };
  }, [flowId, isOpen]);

  if (!isOpen) return null;

  async function viewVersion(version: AutomationVersionSummary) {
    setIsLoading(true);
    setError(null);

    try {
      const data = await readJson(
        await fetch(
          `/api/automation/flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(version.id)}`,
        ),
      );

      setPreviewGraph(data.graph ?? null);
      setPreviewTitle(`Version ${version.versionNumber}`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to load version graph",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function confirmRollback() {
    if (!rollbackTarget) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = (await readJson(
        await fetch(
          `/api/automation/flows/${encodeURIComponent(flowId)}/versions/${encodeURIComponent(rollbackTarget.id)}/rollback`,
          {
            body: JSON.stringify({
              publishNotes: rollbackNotes || undefined,
            }),
            headers: {
              "content-type": "application/json",
            },
            method: "POST",
          },
        ),
      )) as AutomationRollbackResult;

      onRollback(data);
      setRollbackTarget(null);
      setRollbackNotes("");
      setVersions((current) => [
        {
          id: data.version.id,
          isCurrentPublished: true,
          isRollback: true,
          publishedAt: data.version.publishedAt,
          publishedByUserId: null,
          publishNotes: data.version.publishNotes,
          validationSummary: {
            errorCount: 0,
            warningCount: 0,
          },
          versionNumber: data.version.versionNumber,
        },
        ...current.map((version) => ({
          ...version,
          isCurrentPublished: false,
        })),
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Rollback failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#BFE9D0] bg-white shadow-[0_16px_36px_rgba(8,27,58,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7F8EF] px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
            <Clock3 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#081B3A]">Version History</p>
            <p className="mt-1 text-xs text-[#526173]">
              Rollback creates a new published version. Old sessions keep their version.
            </p>
          </div>
        </div>
        <button
          className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
          onClick={onClose}
          type="button"
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Close
        </button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="grid content-start gap-3">
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              {error}
            </div>
          ) : null}
          {versions.length === 0 && !isLoading ? (
            <div className="rounded-xl border border-[#BFE9D0] bg-[#F7FBFF] p-4 text-sm font-semibold text-[#526173]">
              No published versions yet.
            </div>
          ) : null}
          {versions.map((version) => (
            <div
              className="rounded-xl border border-[#D6EADF] bg-white p-4 shadow-[0_10px_22px_rgba(8,27,58,0.05)]"
              key={version.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-[#081B3A]">
                      Version {version.versionNumber}
                    </p>
                    {version.isCurrentPublished ? (
                      <span className="rounded-full bg-[#E7F8EF] px-2.5 py-1 text-[11px] font-bold text-[#128C7E]">
                        Current published
                      </span>
                    ) : null}
                    {version.isRollback ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                        Rollback
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#526173]">
                    {new Date(version.publishedAt).toLocaleString("en-IN")}
                  </p>
                  {version.publishNotes ? (
                    <p className="mt-2 text-sm text-[#526173]">
                      {version.publishNotes}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs font-semibold text-[#526173]">
                    {version.validationSummary.errorCount} errors,{" "}
                    {version.validationSummary.warningCount} warnings at publish
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                    disabled={isLoading}
                    onClick={() => viewVersion(version)}
                    type="button"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isLoading || version.isCurrentPublished}
                    onClick={() => setRollbackTarget(version)}
                    type="button"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Rollback
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[#D6EADF] bg-[#F7FBFF] p-4">
          <p className="text-sm font-bold text-[#081B3A]">
            {previewTitle || "Version preview"}
          </p>
          <pre className="mt-3 max-h-[520px] overflow-auto rounded-xl bg-[#081B3A] p-4 text-xs leading-5 text-[#DFF8EB]">
            {previewGraph
              ? JSON.stringify(previewGraph, null, 2)
              : "Select a version to preview its immutable graph."}
          </pre>
        </div>
      </div>

      {rollbackTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-[0_22px_70px_rgba(8,27,58,0.28)]">
            <p className="text-lg font-bold text-[#081B3A]">
              Rollback to Version {rollbackTarget.versionNumber}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#526173]">
              This will create a new published version from Version{" "}
              {rollbackTarget.versionNumber}. Existing sessions will continue on
              their current versions.
            </p>
            <label className="mt-4 grid gap-1.5 text-xs font-semibold text-[#526173]">
              Rollback notes
              <textarea
                className="min-h-24 rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm text-[#081B3A] outline-none focus:border-[#128C7E]"
                onChange={(event) => setRollbackNotes(event.target.value)}
                value={rollbackNotes}
              />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-semibold text-[#128C7E]"
                onClick={() => setRollbackTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading}
                onClick={confirmRollback}
                type="button"
              >
                Confirm rollback
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
