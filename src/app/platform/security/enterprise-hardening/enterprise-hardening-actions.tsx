"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SelectOption = {
  id: string;
  name: string;
};

type ClientRelationshipOption = {
  id: string;
  partnerCompanyId: string;
  clientCompanyId: string;
  clientName: string;
};

type ApiResult = {
  message?: string;
  ok?: boolean;
};

async function readApiResult(response: Response) {
  try {
    return (await response.json()) as ApiResult;
  } catch {
    return {};
  }
}

export function ApprovalDecisionActions({
  approvalId,
  canDecide,
  requestedByCurrentUser,
}: {
  approvalId: string;
  canDecide: boolean;
  requestedByCurrentUser: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function decide(decision: "approve" | "reject" | "cancel") {
    setError("");

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Add a decision reason first.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/platform/enterprise-hardening/approvals/${approvalId}/decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        },
      );
      const data = await readApiResult(response);

      if (!response.ok) {
        setError(data.message ?? "Unable to update approval.");
        return;
      }

      setReason("");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  if (!canDecide) {
    return (
      <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
        Super admin access is required to decide this approval.
      </p>
    );
  }

  if (requestedByCurrentUser) {
    return (
      <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
        Two-person approval is enforced. The requester cannot approve their own
        action.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Decision reason"
        rows={2}
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => decide("approve")}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-200"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => decide("reject")}
          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-black text-white disabled:bg-slate-200"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => decide("cancel")}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 disabled:text-slate-400"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function OffboardingRequestForm({
  canCreate,
  partners,
}: {
  canCreate: boolean;
  partners: SelectOption[];
}) {
  const router = useRouter();
  const [partnerCompanyId, setPartnerCompanyId] = useState(partners[0]?.id ?? "");
  const [clientPolicy, setClientPolicy] = useState("KEEP_WITH_METAWHAT");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!canCreate) {
      setError("Partner manage permission is required.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/platform/enterprise-hardening/offboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerCompanyId, clientPolicy, reason }),
      });
      const data = await readApiResult(response);

      if (!response.ok) {
        setError(data.message ?? "Unable to request offboarding.");
        return;
      }

      setReason("");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Request offboarding</h2>
      <p className="mt-1 text-sm text-slate-600">
        Starts a two-person approval flow before a partner can be offboarded.
      </p>

      <div className="mt-4 space-y-3">
        <select
          value={partnerCompanyId}
          onChange={(event) => setPartnerCompanyId(event.target.value)}
          disabled={!canCreate || partners.length === 0}
          className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              {partner.name}
            </option>
          ))}
        </select>

        <select
          value={clientPolicy}
          onChange={(event) => setClientPolicy(event.target.value)}
          disabled={!canCreate}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="KEEP_WITH_METAWHAT">Keep clients with MetaWhat</option>
          <option value="TRANSFER_TO_PARTNER">Transfer clients to partner</option>
          <option value="SUSPEND_CLIENTS">Suspend clients</option>
        </select>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={!canCreate}
          placeholder="Reason, risk context, and expected outcome"
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />

        <button
          type="submit"
          disabled={!canCreate || !partnerCompanyId || reason.trim().length < 10 || isSaving}
          className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isSaving ? "Requesting..." : "Create offboarding approval"}
        </button>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function ClientTransferRequestForm({
  canCreate,
  partners,
  relationships,
}: {
  canCreate: boolean;
  partners: SelectOption[];
  relationships: ClientRelationshipOption[];
}) {
  const router = useRouter();
  const [fromPartnerCompanyId, setFromPartnerCompanyId] = useState(
    relationships[0]?.partnerCompanyId ?? partners[0]?.id ?? "",
  );
  const availableClients = useMemo(
    () =>
      relationships.filter(
        (relationship) => relationship.partnerCompanyId === fromPartnerCompanyId,
      ),
    [fromPartnerCompanyId, relationships],
  );
  const [clientCompanyId, setClientCompanyId] = useState(
    availableClients[0]?.clientCompanyId ?? "",
  );
  const [toPartnerCompanyId, setToPartnerCompanyId] = useState("");
  const [transferMode, setTransferMode] = useState("MOVE_TO_METAWHAT");
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function updateFromPartner(nextPartnerId: string) {
    const nextClients = relationships.filter(
      (relationship) => relationship.partnerCompanyId === nextPartnerId,
    );
    setFromPartnerCompanyId(nextPartnerId);
    setClientCompanyId(nextClients[0]?.clientCompanyId ?? "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!canCreate) {
      setError("Partner manage permission is required.");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        fromPartnerCompanyId,
        clientCompanyId,
        toPartnerCompanyId: toPartnerCompanyId || undefined,
        transferMode,
        reason,
      };
      const response = await fetch(
        "/api/platform/enterprise-hardening/client-transfers",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await readApiResult(response);

      if (!response.ok) {
        setError(data.message ?? "Unable to request client transfer.");
        return;
      }

      setReason("");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Request client transfer</h2>
      <p className="mt-1 text-sm text-slate-600">
        Move or detach a client workspace using the approval workflow.
      </p>

      <div className="mt-4 space-y-3">
        <select
          value={fromPartnerCompanyId}
          onChange={(event) => updateFromPartner(event.target.value)}
          disabled={!canCreate || partners.length === 0}
          className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {partners.map((partner) => (
            <option key={partner.id} value={partner.id}>
              From: {partner.name}
            </option>
          ))}
        </select>

        <select
          value={clientCompanyId}
          onChange={(event) => setClientCompanyId(event.target.value)}
          disabled={!canCreate || availableClients.length === 0}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          {availableClients.map((relationship) => (
            <option key={relationship.id} value={relationship.clientCompanyId}>
              Client: {relationship.clientName}
            </option>
          ))}
        </select>

        <select
          value={transferMode}
          onChange={(event) => setTransferMode(event.target.value)}
          disabled={!canCreate}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="MOVE_TO_METAWHAT">Move to MetaWhat</option>
          <option value="MOVE_TO_PARTNER">Move to another partner</option>
          <option value="DETACH_FROM_PARTNER">Detach from partner</option>
        </select>

        {transferMode === "MOVE_TO_PARTNER" ? (
          <select
            value={toPartnerCompanyId}
            onChange={(event) => setToPartnerCompanyId(event.target.value)}
            disabled={!canCreate}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Select destination partner</option>
            {partners
              .filter((partner) => partner.id !== fromPartnerCompanyId)
              .map((partner) => (
                <option key={partner.id} value={partner.id}>
                  To: {partner.name}
                </option>
              ))}
          </select>
        ) : null}

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={!canCreate}
          placeholder="Reason, client impact, and approval notes"
          rows={4}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />

        <button
          type="submit"
          disabled={
            !canCreate ||
            !fromPartnerCompanyId ||
            !clientCompanyId ||
            reason.trim().length < 10 ||
            isSaving
          }
          className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {isSaving ? "Requesting..." : "Create transfer approval"}
        </button>

        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function DomainChallengeVerifyButton({
  canVerify,
  domainId,
}: {
  canVerify: boolean;
  domainId: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch(
        "/api/platform/enterprise-hardening/domain-challenges/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domainId }),
        },
      );
      const data = await readApiResult(response);

      if (!response.ok) {
        setError(data.message ?? "Unable to verify domain challenge.");
        return;
      }

      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={verify}
        disabled={!canVerify || isSaving}
        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
      >
        {isSaving ? "Checking..." : "Verify TXT"}
      </button>
      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
