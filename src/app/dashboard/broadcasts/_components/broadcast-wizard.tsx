"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Copy,
  Eye,
  Filter,
  LayoutTemplate,
  Megaphone,
  MessageSquareText,
  Save,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { actionButtonClass, StatusPill } from "@/app/dashboard/dashboard-ui";
import { buildTemplatePreview } from "@/lib/whatsapp-template/template-variable-parser";

const OBJECTIVES = [
  {
    description: "Offers, launches, seasonal deals, and retargeting.",
    label: "Promotion",
    value: "PROMOTION",
  },
  {
    description: "General business announcement or customer update.",
    label: "Announcement",
    value: "ANNOUNCEMENT",
  },
  {
    description: "Invoice, due amount, or payment follow-up.",
    label: "Payment reminder",
    value: "PAYMENT_REMINDER",
  },
  {
    description: "Delivery, shipment, or order milestone communication.",
    label: "Order update",
    value: "ORDER_UPDATE",
  },
  {
    description: "Bring inactive customers back with useful context.",
    label: "Customer re-engagement",
    value: "CUSTOMER_RE_ENGAGEMENT",
  },
  {
    description: "Invite customers to demos, events, or webinars.",
    label: "Event invite",
    value: "EVENT_INVITE",
  },
  {
    description: "A custom broadcast goal for this campaign.",
    label: "Other",
    value: "OTHER",
  },
] as const;

const STEPS = [
  {
    description: "Name the campaign and choose the business goal.",
    icon: Megaphone,
    key: "setup",
    label: "Setup",
  },
  {
    description: "Choose contacts, groups, or segments.",
    icon: Users,
    key: "audience",
    label: "Audience",
  },
  {
    description: "Pick an approved WhatsApp template.",
    icon: LayoutTemplate,
    key: "template",
    label: "Template",
  },
  {
    description: "Map variables and fallback values.",
    icon: Sparkles,
    key: "personalise",
    label: "Personalise",
  },
  {
    description: "Set send time and business-hour rules.",
    icon: CalendarClock,
    key: "schedule",
    label: "Schedule",
  },
  {
    description: "Validate, estimate cost, and prepare launch.",
    icon: Send,
    key: "review",
    label: "Review",
  },
] as const;

type BroadcastDraftData = Record<string, unknown>;

type AudienceOptions = {
  cities: string[];
  groups: Array<{ _count: { members: number }; id: string; name: string }>;
  segments: Array<{ id: string; lastPreviewCount: number; name: string }>;
  sources: string[];
  tags: Array<{ id: string; name: string }>;
};

type AudiencePreview = {
  counts: {
    blocked: number;
    duplicatePhones: number;
    duplicateSelections: number;
    eligible: number;
    invalidPhone: number;
    missingConsent: number;
    optedOut: number;
    totalMatched: number;
  };
  sampleContacts: Array<{
    city: string | null;
    id: string;
    name: string | null;
    phone: string;
    source: string;
    tags: string[];
  }>;
};

type ApprovedTemplate = {
  body: string;
  category: string;
  components: unknown;
  id: string;
  language: string;
  name: string;
  qualityScore: string | null;
  variables: string[];
};

type SelectedTemplateState = {
  body: string;
  category: string;
  language: string;
  templateId: string;
  templateName: string;
  variables: string[];
};

type VariableMapping = {
  customValue: string;
  fallback: string;
  source: "CONTACT_NAME" | "PHONE_NUMBER" | "CITY" | "SOURCE" | "CUSTOM";
};

type TestRecipient = {
  countryCode: string;
  name: string;
  phoneNumber: string;
};

type ScheduleState = {
  businessHoursEnd: string;
  businessHoursOnly: boolean;
  businessHoursStart: string;
  recipientTimezoneScheduling: boolean;
  recurringEnabled: boolean;
  recurringEndsAt: string;
  recurringFrequency: "DAILY" | "WEEKLY" | "MONTHLY";
  recurringInterval: number;
  scheduledAt: string;
  sendMode: "NOW" | "SCHEDULED";
  timezone: string;
};

type PreflightCheck = {
  id: string;
  label: string;
  message: string;
  status: "PASS" | "WARN" | "FAIL";
};

type PreflightResult = {
  blockers: string[];
  checks: PreflightCheck[];
  ok: boolean;
  summary: {
    eligibleRecipients: number;
    estimatedCostPaise: number;
    estimatedDurationMinutes: number;
    messagePricePaise: number;
    throughputPerMinute: number;
    walletAfterPaise: number;
    walletBalancePaise: number;
  };
  warnings: string[];
};

type BroadcastWizardProps = {
  initialDraft?: {
    currentStep: number;
    draftData: BroadcastDraftData;
    id: string;
    name: string;
    objective: string;
    updatedAt: string;
  } | null;
  readiness: Array<{
    complete: boolean;
    label: string;
    value: string;
  }>;
};

function getErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  return "Unable to save broadcast draft";
}

function formatSavedAt(value: Date | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en-IN", {
    timeStyle: "short",
  }).format(value);
}

function getInitialAudience(draftData: BroadcastDraftData) {
  const raw = draftData.audience;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      city: "",
      groupIds: [] as string[],
      requireMarketingConsent: true,
      segmentIds: [] as string[],
      source: "",
      tag: "",
    };
  }

  const audience = raw as Record<string, unknown>;

  return {
    city: typeof audience.city === "string" ? audience.city : "",
    groupIds: Array.isArray(audience.groupIds)
      ? audience.groupIds.filter((id): id is string => typeof id === "string")
      : [],
    requireMarketingConsent:
      typeof audience.requireMarketingConsent === "boolean"
        ? audience.requireMarketingConsent
        : true,
    segmentIds: Array.isArray(audience.segmentIds)
      ? audience.segmentIds.filter((id): id is string => typeof id === "string")
      : [],
    source: typeof audience.source === "string" ? audience.source : "",
    tag: typeof audience.tag === "string" ? audience.tag : "",
  };
}

function getInitialTemplate(draftData: BroadcastDraftData): SelectedTemplateState {
  const raw = draftData.template;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      body: "",
      category: "",
      language: "",
      templateId: "",
      templateName: "",
      variables: [],
    };
  }

  const template = raw as Record<string, unknown>;

  return {
    body: typeof template.body === "string" ? template.body : "",
    category: typeof template.category === "string" ? template.category : "",
    language: typeof template.language === "string" ? template.language : "",
    templateId:
      typeof template.templateId === "string" ? template.templateId : "",
    templateName:
      typeof template.templateName === "string" ? template.templateName : "",
    variables: Array.isArray(template.variables)
      ? template.variables.filter(
          (variable): variable is string => typeof variable === "string",
        )
      : [],
  };
}

function getInitialMappings(draftData: BroadcastDraftData) {
  const raw = draftData.personalisation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {} as Record<string, VariableMapping>;
  }

  const personalisation = raw as Record<string, unknown>;
  const mappings = personalisation.mappings;
  if (!mappings || typeof mappings !== "object" || Array.isArray(mappings)) {
    return {} as Record<string, VariableMapping>;
  }

  return Object.entries(mappings as Record<string, unknown>).reduce<
    Record<string, VariableMapping>
  >((next, [key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return next;
    }

    const mapping = value as Record<string, unknown>;
    const source =
      mapping.source === "PHONE_NUMBER" ||
      mapping.source === "CITY" ||
      mapping.source === "SOURCE" ||
      mapping.source === "CUSTOM"
        ? mapping.source
        : "CONTACT_NAME";

    next[key] = {
      customValue:
        typeof mapping.customValue === "string" ? mapping.customValue : "",
      fallback: typeof mapping.fallback === "string" ? mapping.fallback : "",
      source,
    };

    return next;
  }, {});
}

function getInitialTestRecipient(draftData: BroadcastDraftData): TestRecipient {
  const raw = draftData.personalisation;
  const fallback = {
    countryCode: "91",
    name: "",
    phoneNumber: "",
  };

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const personalisation = raw as Record<string, unknown>;
  const testRecipient = personalisation.testRecipient;
  if (
    !testRecipient ||
    typeof testRecipient !== "object" ||
    Array.isArray(testRecipient)
  ) {
    return fallback;
  }

  const record = testRecipient as Record<string, unknown>;

  return {
    countryCode:
      typeof record.countryCode === "string" ? record.countryCode : "91",
    name: typeof record.name === "string" ? record.name : "",
    phoneNumber:
      typeof record.phoneNumber === "string" ? record.phoneNumber : "",
  };
}

function getInitialSchedule(draftData: BroadcastDraftData): ScheduleState {
  const fallback: ScheduleState = {
    businessHoursEnd: "18:00",
    businessHoursOnly: false,
    businessHoursStart: "09:00",
    recipientTimezoneScheduling: false,
    recurringEnabled: false,
    recurringEndsAt: "",
    recurringFrequency: "WEEKLY",
    recurringInterval: 1,
    scheduledAt: "",
    sendMode: "NOW",
    timezone: "Asia/Kolkata",
  };
  const raw = draftData.schedule;

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const schedule = raw as Record<string, unknown>;
  const recurring =
    schedule.recurring &&
    typeof schedule.recurring === "object" &&
    !Array.isArray(schedule.recurring)
      ? (schedule.recurring as Record<string, unknown>)
      : {};

  return {
    businessHoursEnd:
      typeof schedule.businessHoursEnd === "string"
        ? schedule.businessHoursEnd
        : fallback.businessHoursEnd,
    businessHoursOnly:
      typeof schedule.businessHoursOnly === "boolean"
        ? schedule.businessHoursOnly
        : fallback.businessHoursOnly,
    businessHoursStart:
      typeof schedule.businessHoursStart === "string"
        ? schedule.businessHoursStart
        : fallback.businessHoursStart,
    recipientTimezoneScheduling:
      typeof schedule.recipientTimezoneScheduling === "boolean"
        ? schedule.recipientTimezoneScheduling
        : fallback.recipientTimezoneScheduling,
    recurringEnabled:
      typeof recurring.enabled === "boolean"
        ? recurring.enabled
        : fallback.recurringEnabled,
    recurringEndsAt:
      typeof recurring.endsAt === "string" ? recurring.endsAt : "",
    recurringFrequency:
      recurring.frequency === "DAILY" ||
      recurring.frequency === "WEEKLY" ||
      recurring.frequency === "MONTHLY"
        ? recurring.frequency
        : fallback.recurringFrequency,
    recurringInterval:
      typeof recurring.interval === "number" && recurring.interval > 0
        ? recurring.interval
        : fallback.recurringInterval,
    scheduledAt:
      typeof schedule.scheduledAt === "string" ? schedule.scheduledAt : "",
    sendMode: schedule.sendMode === "SCHEDULED" ? "SCHEDULED" : "NOW",
    timezone:
      typeof schedule.timezone === "string" && schedule.timezone.trim()
        ? schedule.timezone
        : fallback.timezone,
  };
}

function phoneDigits(value: string) {
  return value.replace(/\D/g, "");
}

function splitPreviewPhone(phone: string) {
  const digits = phoneDigits(phone);
  if (digits.startsWith("91") && digits.length > 10) {
    return { countryCode: "91", phoneNumber: digits.slice(2) };
  }

  return { countryCode: "91", phoneNumber: digits };
}

function formatPaise(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(amountPaise / 100);
}

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours} hr ${remainingMinutes} min`
    : `${hours} hr`;
}

export function BroadcastWizard({
  initialDraft = null,
  readiness,
}: BroadcastWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeStep, setActiveStep] = useState(
    Math.min(Math.max(initialDraft?.currentStep ?? 1, 1), STEPS.length),
  );
  const [draftData, setDraftData] = useState<BroadcastDraftData>(
    initialDraft?.draftData ?? {},
  );
  const [draftId, setDraftId] = useState(initialDraft?.id ?? "");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(
    initialDraft?.updatedAt ? new Date(initialDraft.updatedAt) : null,
  );
  const [name, setName] = useState(initialDraft?.name ?? "");
  const [objective, setObjective] = useState(
    initialDraft?.objective ?? "PROMOTION",
  );
  const [audienceOptions, setAudienceOptions] = useState<AudienceOptions>({
    cities: [],
    groups: [],
    segments: [],
    sources: [],
    tags: [],
  });
  const [audience, setAudience] = useState(() =>
    getInitialAudience(initialDraft?.draftData ?? {}),
  );
  const [audiencePreview, setAudiencePreview] =
    useState<AudiencePreview | null>(null);
  const [isAudienceLoading, setIsAudienceLoading] = useState(false);
  const [templates, setTemplates] = useState<ApprovedTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState(() =>
    getInitialTemplate(initialDraft?.draftData ?? {}),
  );
  const [variableMappings, setVariableMappings] = useState(() =>
    getInitialMappings(initialDraft?.draftData ?? {}),
  );
  const [previewContactId, setPreviewContactId] = useState(() => {
    const raw = initialDraft?.draftData.personalisation;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
    const personalisation = raw as Record<string, unknown>;
    return typeof personalisation.previewContactId === "string"
      ? personalisation.previewContactId
      : "";
  });
  const [testRecipient, setTestRecipient] = useState(() =>
    getInitialTestRecipient(initialDraft?.draftData ?? {}),
  );
  const [schedule, setSchedule] = useState(() =>
    getInitialSchedule(initialDraft?.draftData ?? {}),
  );
  const [minimumScheduleInput] = useState(() =>
    new Date(Date.now() + 60_000).toISOString().slice(0, 16),
  );
  const [testMessageStatus, setTestMessageStatus] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightError, setPreflightError] = useState("");
  const [preflightSignatureAtRun, setPreflightSignatureAtRun] = useState("");
  const [isPreflightLoading, setIsPreflightLoading] = useState(false);
  const [launchStatus, setLaunchStatus] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);

  const selectedObjective = useMemo(
    () => OBJECTIVES.find((item) => item.value === objective) ?? OBJECTIVES[0],
    [objective],
  );

  const completedReadiness = readiness.filter((item) => item.complete).length;
  const canSave = name.trim().length >= 2 && objective.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      const [audienceResponse, templateResponse] = await Promise.all([
        fetch("/api/broadcast-drafts/audience"),
        fetch("/api/broadcast-drafts/template-assets"),
      ]);
      const audiencePayload: unknown = await audienceResponse
        .json()
        .catch(() => ({}));
      const templatePayload: unknown = await templateResponse
        .json()
        .catch(() => ({}));

      if (
        !cancelled &&
        audienceResponse.ok &&
        audiencePayload &&
        typeof audiencePayload === "object" &&
        "options" in audiencePayload
      ) {
        setAudienceOptions(audiencePayload.options as AudienceOptions);
      }

      if (
        !cancelled &&
        templateResponse.ok &&
        templatePayload &&
        typeof templatePayload === "object" &&
        "templates" in templatePayload
      ) {
        setTemplates(templatePayload.templates as ApprovedTemplate[]);
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setIsAudienceLoading(true);
      const response = await fetch("/api/broadcast-drafts/audience", {
        body: JSON.stringify({
          filters: {
            city: audience.city || null,
            source: audience.source || null,
            tag: audience.tag || null,
          },
          groupIds: audience.groupIds,
          requireMarketingConsent: audience.requireMarketingConsent,
          segmentIds: audience.segmentIds,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const payload: unknown = await response.json().catch(() => ({}));

      if (cancelled) return;
      setIsAudienceLoading(false);

      if (
        response.ok &&
        payload &&
        typeof payload === "object" &&
        "preview" in payload
      ) {
        setAudiencePreview(payload.preview as AudiencePreview);
      }
    }

  const timer = window.setTimeout(() => {
      void loadPreview();
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [audience]);

  const selectedTemplateRecord = useMemo(
    () =>
      templates.find((template) => template.id === selectedTemplate.templateId) ??
      null,
    [selectedTemplate.templateId, templates],
  );

  const previewContact = useMemo(() => {
    const samples = audiencePreview?.sampleContacts ?? [];
    return (
      samples.find((contact) => contact.id === previewContactId) ??
      samples[0] ??
      null
    );
  }, [audiencePreview?.sampleContacts, previewContactId]);

  const resolvedVariables = useMemo(
    () =>
      selectedTemplate.variables.map((variable) => {
        const mapping = variableMappings[variable] ?? {
          customValue: "",
          fallback: "",
          source: "CONTACT_NAME" as const,
        };
        const contact = previewContact;
        const value =
          mapping.source === "CUSTOM"
            ? mapping.customValue
            : mapping.source === "PHONE_NUMBER"
              ? contact?.phone
              : mapping.source === "CITY"
                ? contact?.city
                : mapping.source === "SOURCE"
                  ? contact?.source
                  : contact?.name;

        return (value || mapping.fallback || "").trim();
      }),
    [previewContact, selectedTemplate.variables, variableMappings],
  );

  const previewSampleValues = useMemo(
    () =>
      selectedTemplate.variables.reduce<Record<string, string>>(
        (values, variable, index) => {
          const value = resolvedVariables[index] || variableMappings[variable]?.fallback || variable;
          values[variable] = value;
          values[variable.replace(/^(BODY_|HEADER_)/, "")] = value;
          values[variable.replace(/^(body_|header_)/, "")] = value;
          return values;
        },
        {},
      ),
    [resolvedVariables, selectedTemplate.variables, variableMappings],
  );

  const renderedPreview = useMemo(() => {
    const template = selectedTemplateRecord ?? {
      body: selectedTemplate.body,
      components: null,
      variables: selectedTemplate.variables,
    };

    return buildTemplatePreview(template, previewSampleValues);
  }, [previewSampleValues, selectedTemplate, selectedTemplateRecord]);

  const preflightSignature = useMemo(
    () =>
      JSON.stringify({
        audience,
        name,
        objective,
        schedule,
        selectedTemplate,
        variableMappings,
      }),
    [audience, name, objective, schedule, selectedTemplate, variableMappings],
  );

  const isPreflightStale = Boolean(
    preflight && preflightSignatureAtRun !== preflightSignature,
  );

  async function saveDraft(nextStep = activeStep) {
    setError("");

    if (!canSave) {
      setError("Add a campaign name and objective before saving this draft.");
      return null;
    }

    const nextDraftData = {
      ...draftData,
      audience: {
        city: audience.city || null,
        estimatedRecipients: audiencePreview?.counts.eligible ?? 0,
        groupIds: audience.groupIds,
        requireMarketingConsent: audience.requireMarketingConsent,
        segmentIds: audience.segmentIds,
        source: audience.source || null,
        tag: audience.tag || null,
      },
      personalisation: {
        mappings: variableMappings,
        previewContactId: previewContact?.id ?? (previewContactId || null),
        testRecipient,
      },
      schedule: {
        businessHoursEnd: schedule.businessHoursEnd || null,
        businessHoursOnly: schedule.businessHoursOnly,
        businessHoursStart: schedule.businessHoursStart || null,
        recipientTimezoneScheduling: schedule.recipientTimezoneScheduling,
        recurring: {
          enabled: schedule.recurringEnabled,
          endsAt: schedule.recurringEndsAt || null,
          frequency: schedule.recurringFrequency,
          interval: schedule.recurringInterval,
        },
        scheduledAt:
          schedule.sendMode === "SCHEDULED" ? schedule.scheduledAt || null : null,
        sendMode: schedule.sendMode,
        timezone: schedule.timezone || "Asia/Kolkata",
      },
      setup: {
        name: name.trim(),
        objective,
      },
      template: {
        body: selectedTemplate.body || null,
        category: selectedTemplate.category || null,
        language: selectedTemplate.language || null,
        templateId: selectedTemplate.templateId || null,
        templateName: selectedTemplate.templateName || null,
        variables: selectedTemplate.variables,
      },
    };

    const response = await fetch(
      draftId ? `/api/broadcast-drafts/${draftId}` : "/api/broadcast-drafts",
      {
        body: JSON.stringify({
          currentStep: nextStep,
          draftData: nextDraftData,
          name: name.trim(),
          objective,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: draftId ? "PATCH" : "POST",
      },
    );

    const payload: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(getErrorMessage(payload));
      return null;
    }

    const draft =
      payload && typeof payload === "object" && "draft" in payload
        ? payload.draft
        : null;

    if (!draft || typeof draft !== "object" || !("id" in draft)) {
      setError("Draft was saved but the server response was incomplete.");
      return null;
    }

    const nextDraftId = String(draft.id);
    setDraftId(nextDraftId);
    setDraftData(nextDraftData);
    setLastSavedAt(new Date());
    setActiveStep(nextStep);

    if (!draftId) {
      startTransition(() => {
        router.replace(`/dashboard/broadcasts/${nextDraftId}/edit`);
      });
    } else {
      router.refresh();
    }

    return nextDraftId;
  }

  function goToStep(step: number) {
    setActiveStep(step);
    void saveDraft(step);
  }

  function toggleAudienceId(key: "groupIds" | "segmentIds", id: string) {
    setAudience((current) => {
      const values = current[key];
      const nextValues = values.includes(id)
        ? values.filter((value) => value !== id)
        : [...values, id];

      return {
        ...current,
        [key]: nextValues,
      };
    });
  }

  function selectTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);

    if (!template) {
      setSelectedTemplate({
        body: "",
        category: "",
        language: "",
        templateId: "",
        templateName: "",
        variables: [],
      });
      return;
    }

    setSelectedTemplate({
      body: template.body,
      category: template.category,
      language: template.language,
      templateId: template.id,
      templateName: template.name,
      variables: template.variables,
    });

    setVariableMappings((current) =>
      template.variables.reduce<Record<string, VariableMapping>>(
        (next, variable) => {
          next[variable] =
            current[variable] ??
            ({
              customValue: "",
              fallback: "",
              source: "CONTACT_NAME",
            } satisfies VariableMapping);
          return next;
        },
        {},
      ),
    );
  }

  function updateMapping(
    variable: string,
    patch: Partial<VariableMapping>,
  ) {
    setVariableMappings((current) => ({
      ...current,
      [variable]: Object.assign(
        {
          customValue: "",
          fallback: "",
          source: "CONTACT_NAME" as const,
        },
        current[variable] ?? {},
        patch,
      ),
    }));
  }

  async function sendTestMessage() {
    setTestMessageStatus("");

    if (!selectedTemplate.templateId) {
      setTestMessageStatus("Select an approved template before sending a test.");
      return;
    }

    if (!testRecipient.phoneNumber.trim()) {
      setTestMessageStatus("Enter a test recipient phone number.");
      return;
    }

    const missingVariable = selectedTemplate.variables.find(
      (_variable, index) => !resolvedVariables[index]?.trim(),
    );

    if (missingVariable) {
      setTestMessageStatus(`Map or add fallback for ${missingVariable}.`);
      return;
    }

    setIsSendingTest(true);

    const response = await fetch("/api/messages/single-template", {
      body: JSON.stringify({
        bodyParameters: resolvedVariables,
        countryCode: testRecipient.countryCode,
        idempotencyKey: `broadcast-test:${draftId || "new"}:${selectedTemplate.templateId}:${Date.now()}`,
        messageType: "Template",
        name: testRecipient.name || "Broadcast test",
        phoneNumber: testRecipient.phoneNumber,
        templateId: selectedTemplate.templateId,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload: unknown = await response.json().catch(() => ({}));

    setIsSendingTest(false);

    if (!response.ok) {
      setTestMessageStatus(getErrorMessage(payload));
      return;
    }

    setTestMessageStatus("Test message queued successfully.");
  }

  async function runPreflight() {
    setPreflightError("");
    setPreflight(null);

    const nextDraftId = await saveDraft(6);
    if (!nextDraftId) return;

    setIsPreflightLoading(true);

    const response = await fetch(
      `/api/broadcast-drafts/${nextDraftId}/preflight`,
      {
        method: "POST",
      },
    );
    const payload: unknown = await response.json().catch(() => ({}));

    setIsPreflightLoading(false);

    if (!response.ok) {
      setPreflightError(getErrorMessage(payload));
      return;
    }

    if (
      payload &&
      typeof payload === "object" &&
      "preflight" in payload &&
      payload.preflight &&
      typeof payload.preflight === "object"
    ) {
      setPreflight(payload.preflight as PreflightResult);
      setPreflightSignatureAtRun(preflightSignature);
      return;
    }

    setPreflightError("Dry-run response was incomplete.");
  }

  async function launchCampaign(action: "SEND_NOW" | "SCHEDULE_LATER") {
    setLaunchStatus("");
    setPreflightError("");

    if (!preflight || isPreflightStale || !preflight.ok) {
      await runPreflight();
      setLaunchStatus(
        "Dry run has been refreshed. Review the checklist, then launch again.",
      );
      return;
    }

    if (action === "SCHEDULE_LATER" && !schedule.scheduledAt.trim()) {
      setLaunchStatus("Choose a scheduled date and time before scheduling.");
      return;
    }

    const nextDraftId = await saveDraft(6);
    if (!nextDraftId) return;

    setIsLaunching(true);
    const response = await fetch(`/api/broadcast-drafts/${nextDraftId}/launch`, {
      body: JSON.stringify({
        action,
        idempotencyKey: `broadcast-launch:${nextDraftId}:${action}`,
        schedule: {
          businessHoursEnd: schedule.businessHoursEnd || null,
          businessHoursOnly: schedule.businessHoursOnly,
          businessHoursStart: schedule.businessHoursStart || null,
          recipientTimezoneScheduling: schedule.recipientTimezoneScheduling,
          recurring: {
            enabled: false,
            endsAt: null,
            frequency: schedule.recurringFrequency,
            interval: schedule.recurringInterval,
          },
          scheduledAt:
            action === "SCHEDULE_LATER" ? schedule.scheduledAt || null : null,
          timezone: schedule.timezone || "Asia/Kolkata",
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const payload: unknown = await response.json().catch(() => ({}));
    setIsLaunching(false);

    if (!response.ok) {
      setLaunchStatus(getErrorMessage(payload));
      return;
    }

    setLaunchStatus(
      action === "SCHEDULE_LATER"
        ? "Broadcast scheduled safely."
        : "Broadcast queued for runtime sending.",
    );
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="rounded-[24px] border border-[#BFE9D0] bg-white p-4 shadow-[0_18px_48px_rgba(8,27,58,0.07)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-[#128C7E]">
              Campaign wizard
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-[#081B3A]">
              6-step broadcast
            </h2>
          </div>
          <StatusPill tone={draftId ? "green" : "amber"}>
            {draftId ? "Draft" : "New"}
          </StatusPill>
        </div>

        <div className="mt-5 grid gap-2">
          {STEPS.map((step, index) => {
            const stepNumber = index + 1;
            const Icon = step.icon;
            const isActive = activeStep === stepNumber;

            return (
              <button
                className={[
                  "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
                  isActive
                    ? "border-[#128C7E] bg-[#E7F8EF] shadow-[0_14px_30px_rgba(18,140,126,0.12)]"
                    : "border-[#D9F2E4] bg-white hover:border-[#128C7E]/50 hover:bg-[#F6FFFA]",
                ].join(" ")}
                key={step.key}
                onClick={() => goToStep(stepNumber)}
                type="button"
              >
                <span
                  className={[
                    "grid h-10 w-10 shrink-0 place-items-center rounded-2xl",
                    isActive
                      ? "bg-[#128C7E] text-white"
                      : "bg-[#E7F8EF] text-[#128C7E]",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="text-xs font-bold uppercase text-[#128C7E]">
                    Step {stepNumber}
                  </span>
                  <span className="block font-bold text-[#081B3A]">
                    {step.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#526173]">
                    {step.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4">
          <p className="text-sm font-bold text-[#081B3A]">Launch readiness</p>
          <p className="mt-1 text-xs text-[#526173]">
            {completedReadiness} of {readiness.length} production checks ready.
          </p>
          <div className="mt-3 grid gap-2">
            {readiness.map((item) => (
              <div
                className="flex items-center justify-between gap-3 text-xs"
                key={item.label}
              >
                <span className="font-medium text-[#526173]">{item.label}</span>
                <span
                  className={
                    item.complete
                      ? "font-bold text-[#128C7E]"
                      : "font-bold text-[#B7791F]"
                  }
                >
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <section className="rounded-[24px] border border-[#BFE9D0] bg-white p-5 shadow-[0_18px_48px_rgba(8,27,58,0.07)]">
        <div className="flex flex-col gap-3 border-b border-[#E7F8EF] pb-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase text-[#128C7E]">
              Step {activeStep} of {STEPS.length}
            </p>
            <h2 className="mt-1 text-2xl font-extrabold text-[#081B3A]">
              {STEPS[activeStep - 1]?.label}
            </h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              {STEPS[activeStep - 1]?.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastSavedAt ? (
              <span className="text-xs font-semibold text-[#526173]">
                Saved {formatSavedAt(lastSavedAt)}
              </span>
            ) : null}
            <button
              className={actionButtonClass("secondary")}
              disabled={isPending}
              onClick={() => saveDraft(activeStep)}
              type="button"
            >
              <Save className="mr-2 h-4 w-4" />
              {isPending ? "Saving..." : "Save draft"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-[#FFB3C1] bg-[#FFF1F4] px-4 py-3 text-sm font-semibold text-[#D80032]">
            {error}
          </div>
        ) : null}

        {activeStep === 1 ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-5">
              <label>
                <span className="text-sm font-bold text-[#081B3A]">
                  Campaign name
                </span>
                <input
                  className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Example: July payment reminder"
                  value={name}
                />
              </label>

              <label>
                <span className="text-sm font-bold text-[#081B3A]">
                  Campaign objective
                </span>
                <select
                  className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
                  onChange={(event) => setObjective(event.target.value)}
                  value={objective}
                >
                  {OBJECTIVES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-[#B9D9FF] bg-[#EEF6FF] p-4">
                <div className="flex items-start gap-3">
                  <MessageSquareText className="mt-1 h-5 w-5 text-[#2563EB]" />
                  <div>
                    <p className="font-bold text-[#081B3A]">
                      {selectedObjective.label}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      {selectedObjective.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-[#BFE9D0] bg-[#E7F8EF]/55 p-4">
              <p className="text-sm font-bold text-[#081B3A]">
                Draft foundation
              </p>
              <div className="mt-4 grid gap-3">
                {[
                  "Name and objective are saved first.",
                  "Audience, template, variables, schedule, and review are ready as separate steps.",
                  "Launch still stays locked behind approved template, consent, wallet, and dry-run checks.",
                ].map((item) => (
                  <div className="flex items-start gap-2 text-sm" key={item}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
                    <span className="leading-6 text-[#526173]">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeStep === 2 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-5">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-[#F7FBFF] p-4">
                <div className="flex items-start gap-3">
                  <Users className="mt-1 h-5 w-5 text-[#128C7E]" />
                  <div>
                    <h3 className="font-extrabold text-[#081B3A]">
                      Contact groups
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      Select one or more reusable groups. Duplicate contacts
                      across selected sources are detected before launch.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {audienceOptions.groups.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#BFE9D0] bg-white p-4 text-sm text-[#526173]">
                      No contact groups yet.
                    </p>
                  ) : (
                    audienceOptions.groups.map((group) => {
                      const selected = audience.groupIds.includes(group.id);

                      return (
                        <button
                          className={[
                            "rounded-2xl border p-4 text-left transition",
                            selected
                              ? "border-[#128C7E] bg-[#E7F8EF]"
                              : "border-[#BFE9D0] bg-white hover:bg-[#F6FFFA]",
                          ].join(" ")}
                          key={group.id}
                          onClick={() => toggleAudienceId("groupIds", group.id)}
                          type="button"
                        >
                          <span className="block font-bold text-[#081B3A]">
                            {group.name}
                          </span>
                          <span className="mt-1 block text-sm text-[#526173]">
                            {group._count.members.toLocaleString("en-IN")} contacts
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-[22px] border border-[#B9D9FF] bg-[#EEF6FF] p-4">
                <div className="flex items-start gap-3">
                  <Filter className="mt-1 h-5 w-5 text-[#2563EB]" />
                  <div>
                    <h3 className="font-extrabold text-[#081B3A]">
                      Smart segments and filters
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      Combine saved segments with quick city, source, and tag
                      filters for a live audience estimate.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      City
                    </span>
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setAudience((current) => ({
                          ...current,
                          city: event.target.value,
                        }))
                      }
                      value={audience.city}
                    >
                      <option value="">Any city</option>
                      {audienceOptions.cities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      Source
                    </span>
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setAudience((current) => ({
                          ...current,
                          source: event.target.value,
                        }))
                      }
                      value={audience.source}
                    >
                      <option value="">Any source</option>
                      {audienceOptions.sources.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      Tag
                    </span>
                    <select
                      className="mt-2 h-11 w-full rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setAudience((current) => ({
                          ...current,
                          tag: event.target.value,
                        }))
                      }
                      value={audience.tag}
                    >
                      <option value="">Any tag</option>
                      {audienceOptions.tags.map((tag) => (
                        <option key={tag.id} value={tag.name}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {audienceOptions.segments.length === 0 ? (
                    <p className="rounded-2xl border border-dashed border-[#B9D9FF] bg-white p-4 text-sm text-[#526173]">
                      No active smart segments yet.
                    </p>
                  ) : (
                    audienceOptions.segments.map((segment) => {
                      const selected = audience.segmentIds.includes(segment.id);

                      return (
                        <button
                          className={[
                            "rounded-2xl border p-4 text-left transition",
                            selected
                              ? "border-[#2563EB] bg-white"
                              : "border-[#B9D9FF] bg-white/70 hover:bg-white",
                          ].join(" ")}
                          key={segment.id}
                          onClick={() =>
                            toggleAudienceId("segmentIds", segment.id)
                          }
                          type="button"
                        >
                          <span className="block font-bold text-[#081B3A]">
                            {segment.name}
                          </span>
                          <span className="mt-1 block text-sm text-[#526173]">
                            Last preview{" "}
                            {segment.lastPreviewCount.toLocaleString("en-IN")}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase text-[#128C7E]">
                      Live preview
                    </p>
                    <h3 className="mt-1 text-2xl font-extrabold text-[#081B3A]">
                      {isAudienceLoading
                        ? "Checking..."
                        : (audiencePreview?.counts.eligible ?? 0).toLocaleString(
                            "en-IN",
                          )}
                    </h3>
                    <p className="text-sm text-[#526173]">
                      eligible recipients
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-[#128C7E]" />
                </div>
                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[#BFE9D0] bg-[#E7F8EF]/55 p-3">
                  <input
                    checked={audience.requireMarketingConsent}
                    className="mt-1"
                    onChange={(event) =>
                      setAudience((current) => ({
                        ...current,
                        requireMarketingConsent: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#081B3A]">
                      Require marketing consent
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-[#526173]">
                      Recommended for broadcast campaigns. Opt-outs and blocked
                      contacts are always excluded.
                    </span>
                  </span>
                </label>
              </div>

              <div className="rounded-[22px] border border-[#BFE9D0] bg-[#F7FBFF] p-4">
                <p className="font-extrabold text-[#081B3A]">
                  Exclusion checks
                </p>
                <div className="mt-4 grid gap-2">
                  {([
                    ["Matched", audiencePreview?.counts.totalMatched ?? 0, Users],
                    [
                      "Duplicate selections",
                      audiencePreview?.counts.duplicateSelections ?? 0,
                      Copy,
                    ],
                    ["Opted out", audiencePreview?.counts.optedOut ?? 0, Ban],
                    ["Blocked", audiencePreview?.counts.blocked ?? 0, Ban],
                    [
                      "Missing consent",
                      audiencePreview?.counts.missingConsent ?? 0,
                      Ban,
                    ],
                    [
                      "Invalid phone",
                      audiencePreview?.counts.invalidPhone ?? 0,
                      Ban,
                    ],
                  ] satisfies Array<
                    [string, number, typeof Users]
                  >).map(([label, value, Icon]) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm"
                      key={label}
                    >
                      <span className="flex items-center gap-2 text-[#526173]">
                        <Icon className="h-4 w-4 text-[#128C7E]" />
                        {label}
                      </span>
                      <span className="font-bold text-[#081B3A]">
                        {Number(value).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-4">
                <p className="font-extrabold text-[#081B3A]">
                  Sample recipients
                </p>
                <div className="mt-4 grid gap-2">
                  {audiencePreview?.sampleContacts.length ? (
                    audiencePreview.sampleContacts.slice(0, 5).map((contact) => (
                      <div
                        className="rounded-xl border border-[#E7F8EF] bg-[#F7FBFF] px-3 py-2"
                        key={contact.id}
                      >
                        <p className="font-bold text-[#081B3A]">
                          {contact.name || "Unnamed contact"}
                        </p>
                        <p className="mt-1 text-xs text-[#526173]">
                          {contact.phone} · {contact.source}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-[#BFE9D0] bg-[#F7FBFF] p-3 text-sm text-[#526173]">
                      No eligible sample contacts yet.
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        ) : activeStep === 3 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-5">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-[#F7FBFF] p-4">
                <div className="flex items-start gap-3">
                  <LayoutTemplate className="mt-1 h-5 w-5 text-[#128C7E]" />
                  <div>
                    <h3 className="font-extrabold text-[#081B3A]">
                      Approved template selector
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      Only Meta-approved templates are available here. Draft,
                      pending, rejected, paused, and disabled templates stay
                      blocked from campaign launch.
                    </p>
                  </div>
                </div>

                <label className="mt-4 block">
                  <span className="text-sm font-bold text-[#081B3A]">
                    Template
                  </span>
                  <select
                    className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none transition focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
                    onChange={(event) => selectTemplate(event.target.value)}
                    value={selectedTemplate.templateId}
                  >
                    <option value="">Select approved template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} · {template.language} ·{" "}
                        {template.category}
                      </option>
                    ))}
                  </select>
                </label>

                {templates.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-[#FAD89A] bg-[#FFF8E8] p-4 text-sm leading-6 text-[#7A4B00]">
                    No approved templates are available yet. Sync or submit
                    templates first, then come back to this step.
                  </div>
                ) : null}
              </div>

              {selectedTemplateRecord ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["Category", selectedTemplateRecord.category],
                    ["Language", selectedTemplateRecord.language],
                    [
                      "Variables",
                      selectedTemplateRecord.variables.length.toLocaleString(
                        "en-IN",
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
                      key={label}
                    >
                      <p className="text-xs font-bold uppercase text-[#526173]">
                        {label}
                      </p>
                      <p className="mt-1 font-extrabold text-[#081B3A]">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedTemplateRecord?.variables.length ? (
                <div className="rounded-[22px] border border-[#B9D9FF] bg-[#EEF6FF] p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-1 h-5 w-5 text-[#2563EB]" />
                    <div>
                      <h3 className="font-extrabold text-[#081B3A]">
                        Variables detected
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#526173]">
                        You will map these fields in the next step. Fallbacks
                        protect the campaign when a contact field is missing.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedTemplateRecord.variables.map((variable) => (
                      <span
                        className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#2563EB]"
                        key={variable}
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                </div>
              ) : selectedTemplateRecord ? (
                <div className="rounded-[22px] border border-[#BFE9D0] bg-[#E7F8EF]/55 p-4 text-sm font-semibold text-[#128C7E]">
                  This template has no variables, so it can be sent without
                  personalisation mapping.
                </div>
              ) : null}
            </div>

            <aside className="overflow-hidden rounded-[22px] border border-[#BFE9D0] bg-white shadow-[0_14px_34px_rgba(8,27,58,0.06)]">
              <div className="flex items-center gap-3 border-b border-[#E7F8EF] px-4 py-3">
                <Eye className="h-4 w-4 text-[#128C7E]" />
                <p className="font-extrabold text-[#081B3A]">
                  WhatsApp phone preview
                </p>
              </div>
              <div className="bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
                <div className="mx-auto mb-3 w-fit rounded-full bg-white px-3 py-1 text-[11px] text-[#526173] shadow-sm">
                  Today
                </div>
                <div className="ml-auto max-w-[92%] overflow-hidden rounded-xl bg-white text-sm text-[#102040] shadow-sm">
                  {renderedPreview.headerText ? (
                    <p className="px-4 pt-3 font-bold">
                      {renderedPreview.headerText}
                    </p>
                  ) : null}
                  {renderedPreview.mediaType ? (
                    <div className="m-3 rounded-lg bg-[#E7F8EF] px-4 py-8 text-center text-xs font-bold text-[#128C7E]">
                      {renderedPreview.mediaType} header
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap px-4 py-3 leading-6">
                    {renderedPreview.bodyText ||
                      "Select an approved template to preview the message."}
                  </p>
                  {renderedPreview.footerText ? (
                    <p className="px-4 pb-2 text-xs text-[#6B7280]">
                      {renderedPreview.footerText}
                    </p>
                  ) : null}
                  {renderedPreview.buttons.length ? (
                    <div className="border-t border-[#E5E7EB]">
                      {renderedPreview.buttons.slice(0, 3).map((button) => (
                        <div
                          className="border-b border-[#E5E7EB] px-4 py-2 text-center text-sm font-bold text-[#128C7E] last:border-b-0"
                          key={`${button.type}-${button.text}`}
                        >
                          {button.text}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        ) : activeStep === 4 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid gap-5">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-[#F7FBFF] p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="mt-1 h-5 w-5 text-[#128C7E]" />
                  <div>
                    <h3 className="font-extrabold text-[#081B3A]">
                      Dynamic personalisation
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      Map every template variable to a contact field or a custom
                      campaign value. Fallbacks prevent blank messages when a
                      customer record is incomplete.
                    </p>
                  </div>
                </div>

                {!selectedTemplate.templateId ? (
                  <div className="mt-4 rounded-2xl border border-[#FAD89A] bg-[#FFF8E8] p-4 text-sm font-semibold text-[#7A4B00]">
                    Select an approved template before mapping variables.
                  </div>
                ) : selectedTemplate.variables.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-[#BFE9D0] bg-white p-4 text-sm font-semibold text-[#128C7E]">
                    This template has no variables. You can still send a test
                    message below.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {selectedTemplate.variables.map((variable) => {
                      const mapping = variableMappings[variable] ?? {
                        customValue: "",
                        fallback: "",
                        source: "CONTACT_NAME" as const,
                      };

                      return (
                        <div
                          className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
                          key={variable}
                        >
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase text-[#128C7E]">
                                Variable
                              </p>
                              <p className="mt-1 font-extrabold text-[#081B3A]">
                                {variable}
                              </p>
                            </div>
                            <select
                              className="h-11 rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                              onChange={(event) =>
                                updateMapping(variable, {
                                  source: event.target
                                    .value as VariableMapping["source"],
                                })
                              }
                              value={mapping.source}
                            >
                              <option value="CONTACT_NAME">Contact name</option>
                              <option value="PHONE_NUMBER">Phone number</option>
                              <option value="CITY">City</option>
                              <option value="SOURCE">Source</option>
                              <option value="CUSTOM">Custom value</option>
                            </select>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            <label>
                              <span className="text-xs font-bold uppercase text-[#526173]">
                                Fallback value
                              </span>
                              <input
                                className="mt-2 h-11 w-full rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                                onChange={(event) =>
                                  updateMapping(variable, {
                                    fallback: event.target.value,
                                  })
                                }
                                placeholder="Example: Customer"
                                value={mapping.fallback}
                              />
                            </label>
                            <label>
                              <span className="text-xs font-bold uppercase text-[#526173]">
                                Custom value
                              </span>
                              <input
                                className="mt-2 h-11 w-full rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A] disabled:bg-[#F7FBFF]"
                                disabled={mapping.source !== "CUSTOM"}
                                onChange={(event) =>
                                  updateMapping(variable, {
                                    customValue: event.target.value,
                                  })
                                }
                                placeholder="Used only for custom source"
                                value={mapping.customValue}
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-[22px] border border-[#B9D9FF] bg-[#EEF6FF] p-4">
                <div className="flex items-start gap-3">
                  <Send className="mt-1 h-5 w-5 text-[#2563EB]" />
                  <div>
                    <h3 className="font-extrabold text-[#081B3A]">
                      Send test message
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      Queue one real WhatsApp test through the existing message
                      worker. Wallet, consent, quota, and connected-number
                      checks still apply.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[110px_minmax(0,1fr)]">
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      Code
                    </span>
                    <input
                      className="mt-2 h-11 w-full rounded-2xl border border-[#B9D9FF] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setTestRecipient((current) => ({
                          ...current,
                          countryCode: event.target.value,
                        }))
                      }
                      value={testRecipient.countryCode}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      Phone number
                    </span>
                    <input
                      className="mt-2 h-11 w-full rounded-2xl border border-[#B9D9FF] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setTestRecipient((current) => ({
                          ...current,
                          phoneNumber: event.target.value,
                        }))
                      }
                      placeholder="8178444398"
                      value={testRecipient.phoneNumber}
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {previewContact ? (
                    <button
                      className={actionButtonClass("secondary")}
                      onClick={() => {
                        const phone = splitPreviewPhone(previewContact.phone);
                        setTestRecipient({
                          countryCode: phone.countryCode,
                          name: previewContact.name || "",
                          phoneNumber: phone.phoneNumber,
                        });
                      }}
                      type="button"
                    >
                      Use preview customer
                    </button>
                  ) : null}
                  <button
                    className={actionButtonClass("primary")}
                    disabled={isSendingTest || !selectedTemplate.templateId}
                    onClick={sendTestMessage}
                    type="button"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {isSendingTest ? "Sending..." : "Send test"}
                  </button>
                </div>
                {testMessageStatus ? (
                  <div
                    className={[
                      "mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold",
                      testMessageStatus.includes("successfully")
                        ? "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]"
                        : "border-[#FFB3C1] bg-[#FFF1F4] text-[#D80032]",
                    ].join(" ")}
                  >
                    {testMessageStatus}
                  </div>
                ) : null}
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-4">
                <p className="text-xs font-bold uppercase text-[#128C7E]">
                  Real customer preview
                </p>
                <select
                  className="mt-3 h-11 w-full rounded-2xl border border-[#BFE9D0] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                  onChange={(event) => setPreviewContactId(event.target.value)}
                  value={previewContact?.id ?? ""}
                >
                  {(audiencePreview?.sampleContacts ?? []).map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name || contact.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-hidden rounded-[22px] border border-[#BFE9D0] bg-white shadow-[0_14px_34px_rgba(8,27,58,0.06)]">
                <div className="border-b border-[#E7F8EF] px-4 py-3">
                  <p className="font-extrabold text-[#081B3A]">
                    {previewContact?.name || "Customer"}
                  </p>
                  <p className="text-xs text-[#526173]">
                    {previewContact?.phone || "No audience sample selected"}
                  </p>
                </div>
                <div className="bg-[#eee7dd] bg-[radial-gradient(circle_at_12px_12px,rgba(120,110,100,0.13)_1px,transparent_1.5px),radial-gradient(circle_at_34px_28px,rgba(120,110,100,0.09)_1px,transparent_1.5px)] bg-[length:44px_44px] p-4">
                  <div className="ml-auto max-w-[92%] overflow-hidden rounded-xl bg-white text-sm text-[#102040] shadow-sm">
                    {renderedPreview.headerText ? (
                      <p className="px-4 pt-3 font-bold">
                        {renderedPreview.headerText}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap px-4 py-3 leading-6">
                      {renderedPreview.bodyText ||
                        "Map variables to see the personalised preview."}
                    </p>
                    {renderedPreview.footerText ? (
                      <p className="px-4 pb-2 text-xs text-[#6B7280]">
                        {renderedPreview.footerText}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {selectedTemplate.variables.some(
                (_variable, index) => !resolvedVariables[index],
              ) ? (
                <div className="rounded-[22px] border border-[#FAD89A] bg-[#FFF8E8] p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-1 h-5 w-5 text-[#B7791F]" />
                    <p className="text-sm font-semibold leading-6 text-[#7A4B00]">
                      Some variables are unresolved for this preview customer.
                      Add fallbacks before using the campaign.
                    </p>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        ) : activeStep === 5 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-5">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-[#F7FBFF] p-5">
                <div className="flex items-start gap-3">
                  <CalendarClock className="mt-1 h-5 w-5 text-[#128C7E]" />
                  <div>
                    <h3 className="font-extrabold text-[#081B3A]">
                      Sending time
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[#526173]">
                      Choose whether this broadcast should queue immediately or
                      wait for a future scheduled time.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {([
                    {
                      description: "Queue recipients after final review.",
                      label: "Send now",
                      value: "NOW",
                    },
                    {
                      description: "Hold launch until the selected time.",
                      label: "Schedule later",
                      value: "SCHEDULED",
                    },
                  ] as const).map((option) => (
                    <button
                      className={[
                        "rounded-2xl border p-4 text-left transition",
                        schedule.sendMode === option.value
                          ? "border-[#128C7E] bg-[#E7F8EF] shadow-[0_14px_34px_rgba(18,140,126,0.14)]"
                          : "border-[#BFE9D0] bg-white hover:border-[#128C7E]",
                      ].join(" ")}
                      key={option.value}
                      onClick={() =>
                        setSchedule((current) => ({
                          ...current,
                          sendMode: option.value,
                        }))
                      }
                      type="button"
                    >
                      <p className="font-extrabold text-[#081B3A]">
                        {option.label}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-[#526173]">
                        {option.description}
                      </p>
                    </button>
                  ))}
                </div>

                {schedule.sendMode === "SCHEDULED" ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label>
                      <span className="text-xs font-bold uppercase text-[#526173]">
                        Scheduled date and time
                      </span>
                      <input
                        className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
                        min={minimumScheduleInput}
                        onChange={(event) =>
                          setSchedule((current) => ({
                            ...current,
                            scheduledAt: event.target.value,
                          }))
                        }
                        type="datetime-local"
                        value={schedule.scheduledAt.slice(0, 16)}
                      />
                    </label>
                    <label>
                      <span className="text-xs font-bold uppercase text-[#526173]">
                        Timezone
                      </span>
                      <select
                        className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A] outline-none focus:border-[#128C7E] focus:ring-4 focus:ring-[#128C7E]/10"
                        onChange={(event) =>
                          setSchedule((current) => ({
                            ...current,
                            timezone: event.target.value,
                          }))
                        }
                        value={schedule.timezone}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                        <option value="UTC">UTC</option>
                        <option value="Asia/Dubai">Asia/Dubai</option>
                        <option value="Asia/Singapore">Asia/Singapore</option>
                      </select>
                    </label>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-5">
                <h3 className="font-extrabold text-[#081B3A]">
                  Business-hours controls
                </h3>
                <p className="mt-1 text-sm leading-6 text-[#526173]">
                  These settings are stored with the broadcast. Immediate
                  sending still uses the current runtime queue.
                </p>
                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] p-4">
                  <input
                    checked={schedule.businessHoursOnly}
                    className="mt-1 h-4 w-4 accent-[#128C7E]"
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        businessHoursOnly: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <span className="font-bold text-[#081B3A]">
                      Send only inside business hours
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[#526173]">
                      Useful for support and sales teams that want replies while
                      agents are available.
                    </span>
                  </span>
                </label>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      Start
                    </span>
                    <input
                      className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setSchedule((current) => ({
                          ...current,
                          businessHoursStart: event.target.value,
                        }))
                      }
                      type="time"
                      value={schedule.businessHoursStart}
                    />
                  </label>
                  <label>
                    <span className="text-xs font-bold uppercase text-[#526173]">
                      End
                    </span>
                    <input
                      className="mt-2 h-12 w-full rounded-2xl border border-[#BFE9D0] bg-white px-4 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setSchedule((current) => ({
                          ...current,
                          businessHoursEnd: event.target.value,
                        }))
                      }
                      type="time"
                      value={schedule.businessHoursEnd}
                    />
                  </label>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[#B9D9FF] bg-[#EEF6FF] p-4">
                  <input
                    checked={schedule.recipientTimezoneScheduling}
                    className="mt-1 h-4 w-4 accent-[#2563EB]"
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        recipientTimezoneScheduling: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>
                    <span className="font-bold text-[#081B3A]">
                      Respect recipient timezone
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-[#526173]">
                      Stored for the launch policy. Use this when customer data
                      includes reliable timezone information.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <aside className="grid gap-4">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.06)]">
                <p className="text-xs font-bold uppercase text-[#128C7E]">
                  Launch plan
                </p>
                <h3 className="mt-1 font-extrabold text-[#081B3A]">
                  {schedule.sendMode === "SCHEDULED"
                    ? "Scheduled broadcast"
                    : "Immediate broadcast"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">
                  {schedule.sendMode === "SCHEDULED"
                    ? schedule.scheduledAt
                      ? `Will launch at ${schedule.scheduledAt} (${schedule.timezone}).`
                      : "Choose a future date and time before scheduling."
                    : "Will queue as soon as final dry-run validation passes."}
                </p>
              </div>

              <div className="rounded-[22px] border border-[#FAD89A] bg-[#FFF8E8] p-4">
                <p className="font-extrabold text-[#7A4B00]">
                  Recurring campaigns
                </p>
                <p className="mt-2 text-sm leading-6 text-[#7A4B00]">
                  Recurring settings are visible for planning, but launching
                  recurring jobs is guarded until the scheduler worker is added.
                </p>
                <label className="mt-4 flex items-center gap-3 text-sm font-bold text-[#7A4B00]">
                  <input
                    checked={schedule.recurringEnabled}
                    className="h-4 w-4 accent-[#B7791F]"
                    onChange={(event) =>
                      setSchedule((current) => ({
                        ...current,
                        recurringEnabled: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Prepare recurring metadata
                </label>
                {schedule.recurringEnabled ? (
                  <div className="mt-3 grid gap-3">
                    <select
                      className="h-11 rounded-2xl border border-[#FAD89A] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      onChange={(event) =>
                        setSchedule((current) => ({
                          ...current,
                          recurringFrequency: event.target
                            .value as ScheduleState["recurringFrequency"],
                        }))
                      }
                      value={schedule.recurringFrequency}
                    >
                      <option value="DAILY">Daily</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                    <input
                      className="h-11 rounded-2xl border border-[#FAD89A] bg-white px-3 text-sm font-semibold text-[#081B3A]"
                      min={1}
                      max={12}
                      onChange={(event) =>
                        setSchedule((current) => ({
                          ...current,
                          recurringInterval: Number(event.target.value) || 1,
                        }))
                      }
                      type="number"
                      value={schedule.recurringInterval}
                    />
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-5">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-[#F7FBFF] p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-start gap-3">
                    <Send className="mt-1 h-5 w-5 text-[#128C7E]" />
                    <div>
                      <h3 className="font-extrabold text-[#081B3A]">
                        Dry-run and cost safety
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-[#526173]">
                        Validate the saved draft against audience exclusions,
                        approved-template rules, wallet balance, connected
                        phone numbers, and throughput before any launch action.
                      </p>
                    </div>
                  </div>
                  <button
                    className={actionButtonClass("primary")}
                    disabled={isPreflightLoading || !canSave}
                    onClick={runPreflight}
                    type="button"
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    {isPreflightLoading ? "Running..." : "Run dry run"}
                  </button>
                </div>

                {preflightError ? (
                  <div className="mt-4 rounded-2xl border border-[#FFB3C1] bg-[#FFF1F4] px-4 py-3 text-sm font-semibold text-[#D80032]">
                    {preflightError}
                  </div>
                ) : null}

                {isPreflightStale ? (
                  <div className="mt-4 rounded-2xl border border-[#FAD89A] bg-[#FFF8E8] px-4 py-3 text-sm font-semibold text-[#7A4B00]">
                    Draft details changed after the last dry run. Run dry run
                    again before trusting these estimates.
                  </div>
                ) : null}

                {preflight ? (
                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[
                      [
                        "Recipients",
                        preflight.summary.eligibleRecipients.toLocaleString(
                          "en-IN",
                        ),
                        "Eligible after exclusions",
                      ],
                      [
                        "Estimated cost",
                        formatPaise(preflight.summary.estimatedCostPaise),
                        `${formatPaise(
                          preflight.summary.messagePricePaise,
                        )} per message`,
                      ],
                      [
                        "Wallet after",
                        formatPaise(preflight.summary.walletAfterPaise),
                        `${formatPaise(
                          preflight.summary.walletBalancePaise,
                        )} available now`,
                      ],
                      [
                        "Send time",
                        formatDuration(
                          preflight.summary.estimatedDurationMinutes,
                        ),
                        `${preflight.summary.throughputPerMinute.toLocaleString(
                          "en-IN",
                        )} messages/min`,
                      ],
                    ].map(([label, value, detail]) => (
                      <div
                        className="rounded-2xl border border-[#BFE9D0] bg-white p-4"
                        key={label}
                      >
                        <p className="text-xs font-bold uppercase text-[#526173]">
                          {label}
                        </p>
                        <p className="mt-2 text-xl font-extrabold text-[#081B3A]">
                          {value}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[#526173]">
                          {detail}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-[#BFE9D0] bg-white p-5 text-sm leading-6 text-[#526173]">
                    Run a dry run after selecting audience, template, and
                    personalisation. No messages are queued and no wallet
                    balance is reserved in this step.
                  </div>
                )}
              </div>

              {preflight ? (
                <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase text-[#128C7E]">
                        Final preflight checklist
                      </p>
                      <h3 className="mt-1 text-lg font-extrabold text-[#081B3A]">
                        {preflight.ok
                          ? "Ready for launch phase"
                          : "Fix blockers before launch"}
                      </h3>
                    </div>
                    <StatusPill tone={preflight.ok ? "green" : "red"}>
                      {preflight.ok ? "Passed" : "Blocked"}
                    </StatusPill>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {preflight.checks.map((check) => (
                      <div
                        className="flex items-start justify-between gap-4 rounded-2xl border border-[#E7F8EF] bg-[#F7FBFF] p-4"
                        key={check.id}
                      >
                        <div>
                          <p className="font-bold text-[#081B3A]">
                            {check.label}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-[#526173]">
                            {check.message}
                          </p>
                        </div>
                        <StatusPill
                          tone={
                            check.status === "PASS"
                              ? "green"
                              : check.status === "WARN"
                                ? "amber"
                                : "red"
                          }
                        >
                          {check.status}
                        </StatusPill>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="grid gap-4">
              <div className="rounded-[22px] border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.06)]">
                <p className="text-xs font-bold uppercase text-[#128C7E]">
                  Launch controls
                </p>
                <h3 className="mt-1 font-extrabold text-[#081B3A]">
                  {preflight?.ok && !isPreflightStale
                    ? "Ready to launch"
                    : "Run dry run first"}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">
                  Launch creates recipient records, reserves wallet safety,
                  queues messages, and lets delivery webhooks update campaign
                  progress.
                </p>
                <button
                  className={`${actionButtonClass("primary")} mt-4 w-full`}
                  disabled={
                    isLaunching ||
                    !preflight?.ok ||
                    isPreflightStale ||
                    schedule.sendMode !== "NOW"
                  }
                  onClick={() => launchCampaign("SEND_NOW")}
                  type="button"
                >
                  {isLaunching && schedule.sendMode === "NOW"
                    ? "Launching..."
                    : "Send now"}
                </button>
                <button
                  className={`${actionButtonClass("secondary")} mt-3 w-full`}
                  disabled={
                    isLaunching ||
                    !preflight?.ok ||
                    isPreflightStale ||
                    schedule.sendMode !== "SCHEDULED"
                  }
                  onClick={() => launchCampaign("SCHEDULE_LATER")}
                  type="button"
                >
                  {isLaunching && schedule.sendMode === "SCHEDULED"
                    ? "Scheduling..."
                    : "Schedule campaign"}
                </button>
                {launchStatus ? (
                  <div
                    className={[
                      "mt-4 rounded-2xl border px-4 py-3 text-sm font-semibold",
                      launchStatus.includes("queued") ||
                      launchStatus.includes("scheduled")
                        ? "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]"
                        : "border-[#FAD89A] bg-[#FFF8E8] text-[#7A4B00]",
                    ].join(" ")}
                  >
                    {launchStatus}
                  </div>
                ) : null}
                {isPreflightStale ? (
                  <p className="mt-3 text-xs font-semibold text-[#7A4B00]">
                    Draft changed after dry run. Run dry run again before
                    launch.
                  </p>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-[#B9D9FF] bg-[#EEF6FF] p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-1 h-5 w-5 text-[#2563EB]" />
                  <div>
                    <p className="font-extrabold text-[#081B3A]">
                      Safety rules
                    </p>
                    <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#526173]">
                      <li>No message is sent during dry run.</li>
                      <li>No wallet debit or reservation happens here.</li>
                      <li>Only approved templates can pass preflight.</li>
                      <li>Opt-outs, blocked contacts, duplicates, and invalid phones are excluded.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {preflight?.blockers.length ? (
                <div className="rounded-[22px] border border-[#FFB3C1] bg-[#FFF1F4] p-4">
                  <p className="font-extrabold text-[#D80032]">Blockers</p>
                  <div className="mt-3 grid gap-2">
                    {preflight.blockers.map((blocker) => (
                      <p
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#D80032]"
                        key={blocker}
                      >
                        {blocker}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {preflight?.warnings.length ? (
                <div className="rounded-[22px] border border-[#FAD89A] bg-[#FFF8E8] p-4">
                  <p className="font-extrabold text-[#7A4B00]">Warnings</p>
                  <div className="mt-3 grid gap-2">
                    {preflight.warnings.map((warning) => (
                      <p
                        className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#7A4B00]"
                        key={warning}
                      >
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-[#E7F8EF] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link className={actionButtonClass("secondary")} href="/dashboard/broadcasts">
            Back to broadcasts
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              className={actionButtonClass("secondary")}
              disabled={activeStep <= 1 || isPending}
              onClick={() => goToStep(Math.max(1, activeStep - 1))}
              type="button"
            >
              Previous
            </button>
            <button
              className={actionButtonClass("primary")}
              disabled={activeStep >= STEPS.length || isPending}
              onClick={() => goToStep(Math.min(STEPS.length, activeStep + 1))}
              type="button"
            >
              Save and continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
