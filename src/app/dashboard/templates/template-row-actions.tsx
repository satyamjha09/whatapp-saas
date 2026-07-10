"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Archive,
  BarChart3,
  CopyPlus,
  Eye,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

type TemplateRowActionsProps = {
  canManage: boolean;
  status: string;
  templateId: string;
  templateName: string;
};

function IconAction({
  children,
  disabled,
  label,
  onClick,
  tone = "neutral",
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  tone?: "neutral" | "danger" | "success";
}) {
  const toneClass =
    tone === "danger"
      ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
      : tone === "success"
        ? "bg-[#E7F8EF] text-[#128C7E] hover:bg-[#D7F2E1]"
        : "bg-slate-50 text-[#526173] hover:bg-slate-100";

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-grid h-8 w-8 shrink-0 place-items-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-45",
        toneClass,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function LinkAction({
  children,
  href,
  label,
  tone = "neutral",
}: {
  children: ReactNode;
  href: string;
  label: string;
  tone?: "neutral" | "success";
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={[
        "inline-grid h-8 w-8 shrink-0 place-items-center rounded-md transition",
        tone === "success"
          ? "bg-[#E7F8EF] text-[#128C7E] hover:bg-[#D7F2E1]"
          : "bg-slate-50 text-[#526173] hover:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

export default function TemplateRowActions({
  canManage,
  status,
  templateId,
  templateName,
}: TemplateRowActionsProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function runAction({
    confirmMessage,
    method = "POST",
    path,
  }: {
    confirmMessage?: string;
    method?: "DELETE" | "POST";
    path: string;
  }) {
    setError(null);

    if (confirmMessage && !window.confirm(confirmMessage)) return;

    startTransition(async () => {
      try {
        const response = await fetch(path, {
          method,
        });
        const data = (await response.json().catch(() => ({}))) as {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(data.message ?? "Template action failed");
        }

        router.refresh();
      } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "Template action failed",
        );
      }
    });
  }

  const canDelete = ["DRAFT", "REJECTED", "DISABLED"].includes(status);
  const canArchive = canManage && status !== "APPROVED" && status !== "DISABLED";
  const canUse = status === "APPROVED";

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1">
        <LinkAction href={`/dashboard/templates/${templateId}`} label="View template">
          <Eye className="h-4 w-4" />
        </LinkAction>
        <LinkAction
          href={`/dashboard/templates/${templateId}/analytics`}
          label="Analytics"
          tone="success"
        >
          <BarChart3 className="h-4 w-4" />
        </LinkAction>
        <LinkAction href={`/dashboard/templates/${templateId}/edit`} label="Edit template">
          <Pencil className="h-4 w-4" />
        </LinkAction>
        <IconAction
          disabled={!canManage || isPending}
          label={`Duplicate ${templateName}`}
          onClick={() =>
            runAction({
              path: `/api/templates/${templateId}/duplicate`,
            })
          }
        >
          <CopyPlus className="h-4 w-4" />
        </IconAction>
        <IconAction
          disabled={!canManage || isPending}
          label={`Sync ${templateName}`}
          onClick={() =>
            runAction({
              path: `/api/templates/${templateId}/sync`,
            })
          }
        >
          <RefreshCw className="h-4 w-4" />
        </IconAction>
        <LinkAction
          href={canUse ? `/dashboard/campaigns?templateId=${templateId}` : "#"}
          label="Use in campaign"
          tone={canUse ? "success" : "neutral"}
        >
          <Send className="h-4 w-4" />
        </LinkAction>
        <LinkAction
          href={canUse ? `/dashboard/automation?templateId=${templateId}` : "#"}
          label="Use in automation"
          tone={canUse ? "success" : "neutral"}
        >
          <Sparkles className="h-4 w-4" />
        </LinkAction>
        <IconAction
          disabled={!canArchive || isPending}
          label={`Archive ${templateName}`}
          onClick={() =>
            runAction({
              confirmMessage: `Archive ${templateName}?`,
              path: `/api/templates/${templateId}/archive`,
            })
          }
        >
          <Archive className="h-4 w-4" />
        </IconAction>
        <IconAction
          disabled={!canManage || !canDelete || isPending}
          label={`Delete ${templateName}`}
          onClick={() =>
            runAction({
              confirmMessage: `Delete ${templateName}? This cannot be undone.`,
              method: "DELETE",
              path: `/api/templates/${templateId}`,
            })
          }
          tone="danger"
        >
          <Trash2 className="h-4 w-4" />
        </IconAction>
      </div>
      {error ? (
        <p className="mt-1 max-w-[240px] text-right text-[11px] leading-4 text-rose-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
