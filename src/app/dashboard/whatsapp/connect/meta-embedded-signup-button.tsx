"use client";

import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  LoaderCircle,
  LogIn,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

type SignupSession = {
  wabaId?: string;
  phoneNumberId?: string;
};

type EmbeddedSignupEvent = {
  event?: string;
  session: SignupSession | null;
  currentStep?: string;
  errorMessage?: string;
};

type SignupPhoneResult = {
  phoneNumberId: string;
  displayPhoneNumber?: string | null;
  verifiedName?: string | null;
  qualityRating?: string | null;
  success: boolean;
  skipped?: boolean;
  messages?: string[];
  error?: { message?: string } | string | null;
};

type SignupResult = {
  phones: SignupPhoneResult[];
  webhooksSubscribed?: boolean;
};

type ConnectResponse = {
  message?: string;
  connection?: {
    phones?: SignupPhoneResult[];
    webhooksSubscribed?: boolean;
    phoneNumberId?: string;
    displayPhoneNumber?: string | null;
    verifiedName?: string | null;
    qualityRating?: string | null;
  };
};

type ConnectionPhase = "idle" | "opening" | "waiting" | "saving" | "done" | "error";

const metaFlowSteps = [
  {
    title: "Intro and consent",
    description:
      "Meta explains that metawhat will receive access to manage the selected WhatsApp Business Account.",
    icon: BookOpen,
  },
  {
    title: "Business assets",
    description:
      "Choose or create a Business Portfolio, then select or create the WhatsApp Business Account.",
    icon: Building2,
  },
  {
    title: "Business details",
    description:
      "Confirm business name, country, website, category, and time zone inside Meta.",
    icon: ClipboardCheck,
  },
  {
    title: "Phone number",
    description:
      "Use a display name only, add a new number, or choose an eligible existing number.",
    icon: PhoneCall,
  },
  {
    title: "Review and confirm",
    description:
      "Confirm the permissions, then metawhat saves the WABA, phone ID, token, and webhook setup.",
    icon: ShieldCheck,
  },
];

const readinessChecks = [
  "You are an admin of the Facebook Business Portfolio.",
  "Use a new phone number that is not registered on WhatsApp, or an eligible phone number already inside the selected WhatsApp Business Account.",
  "Avoid numbers currently active on the WhatsApp consumer app or another provider unless you are ready to migrate them.",
  "The WhatsApp display name matches the business and follows Meta guidelines.",
  "International payments are enabled on the business payment method if Meta billing/payment setup is required.",
  "Use a trusted Facebook Business admin account with no security restrictions and complete 2FA when Meta asks.",
  "Popups and third-party cookies are allowed for this browser session.",
  "The business is ready for Meta review if additional verification is requested.",
];

const phaseSteps: {
  phase: ConnectionPhase;
  title: string;
  description: string;
}[] = [
  {
    phase: "idle",
    title: "Ready",
    description: "Open Meta's secure Embedded Signup popup.",
  },
  {
    phase: "opening",
    title: "Meta popup",
    description: "Complete the official Business Portfolio, WABA, and phone steps.",
  },
  {
    phase: "waiting",
    title: "Reading result",
    description: "Waiting for Meta to return the authorization code and signup data.",
  },
  {
    phase: "saving",
    title: "Saving account",
    description: "Encrypting token, saving phone numbers, and subscribing webhooks.",
  },
  {
    phase: "done",
    title: "Connected",
    description: "Phone number connected and ready for templates or messaging.",
  },
];

function isConfigured(value: string | undefined, placeholder: string) {
  return Boolean(value && value !== placeholder);
}

function isFacebookOrigin(origin: string) {
  try {
    const url = new URL(origin);

    return (
      url.protocol === "https:" &&
      (url.hostname === "facebook.com" ||
        url.hostname.endsWith(".facebook.com"))
    );
  } catch {
    return false;
  }
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractSignupEvent(eventData: unknown): EmbeddedSignupEvent | null {
  if (!eventData || typeof eventData !== "object") return null;

  const root = eventData as Record<string, unknown>;
  const eventType = stringValue(root.type);
  const eventName = stringValue(root.event);

  if (eventType !== "WA_EMBEDDED_SIGNUP" && eventName !== "WA_EMBEDDED_SIGNUP") {
    return null;
  }

  const signupEventName =
    eventType === "WA_EMBEDDED_SIGNUP"
      ? eventName ?? "WA_EMBEDDED_SIGNUP"
      : "WA_EMBEDDED_SIGNUP";

  const data = root.data;
  const currentStep =
    stringValue(root.currentStep) ??
    stringValue(root.current_step) ??
    (data && typeof data === "object"
      ? stringValue((data as Record<string, unknown>).current_step) ??
        stringValue((data as Record<string, unknown>).currentStep)
      : undefined);

  const errorMessage =
    stringValue(root.errorMessage) ??
    stringValue(root.error_message) ??
    (data && typeof data === "object"
      ? stringValue((data as Record<string, unknown>).error_message) ??
        stringValue((data as Record<string, unknown>).errorMessage)
      : undefined);

  if (!data || typeof data !== "object") {
    return {
      event: signupEventName,
      session: null,
      currentStep,
      errorMessage,
    };
  }

  const signupData = data as Record<string, unknown>;
  const wabaId = stringValue(signupData.waba_id) ?? stringValue(signupData.wabaId);
  const phoneNumberId =
    stringValue(signupData.phone_number_id) ??
    stringValue(signupData.phoneNumberId);

  return {
    event: signupEventName,
    session:
      wabaId || phoneNumberId
        ? {
            wabaId,
            phoneNumberId,
          }
        : null,
    currentStep,
    errorMessage,
  };
}

function getHttpsRequirementMessage(appUrl: string | undefined) {
  if (typeof window === "undefined" || window.location.protocol === "https:") {
    return "";
  }

  return appUrl?.startsWith("https://")
    ? `Facebook Login requires HTTPS. Open this page from ${appUrl}/dashboard/whatsapp/connect.`
    : "Facebook Login requires HTTPS. Open this page from your ngrok HTTPS URL.";
}

function createFlowSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCanonicalConnectRedirectUri(appUrl: string | undefined) {
  const baseUrl =
    appUrl?.trim() || (typeof window !== "undefined" ? window.location.origin : "");

  return `${baseUrl.replace(/\/$/, "")}/dashboard/whatsapp/connect`;
}

function getHostedOnboardingUrl({
  appId,
  configId,
  flowSessionId,
  redirectUri,
}: {
  appId: string;
  configId: string;
  flowSessionId: string;
  redirectUri: string;
}) {
  const url = new URL(
    "https://business.facebook.com/messaging/whatsapp/onboard/",
  );

  url.searchParams.set("app_id", appId);
  url.searchParams.set("config_id", configId);
  url.searchParams.set(
    "extras",
    JSON.stringify({
      version: "v4",
      sessionInfoVersion: "3",
      featureType: "whatsapp_business_app_onboarding",
    }),
  );
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", flowSessionId);

  return url.toString();
}

function getRedirectSignupSession(searchParams: URLSearchParams): SignupSession {
  return {
    wabaId:
      searchParams.get("waba_id") ??
      searchParams.get("wabaId") ??
      undefined,
    phoneNumberId:
      searchParams.get("phone_number_id") ??
      searchParams.get("phoneNumberId") ??
      undefined,
  };
}

function clearHostedOnboardingQuery() {
  const url = new URL(window.location.href);
  [
    "code",
    "state",
    "error",
    "error_code",
    "error_message",
    "error_description",
    "waba_id",
    "wabaId",
    "phone_number_id",
    "phoneNumberId",
  ].forEach((key) => url.searchParams.delete(key));

  const query = url.searchParams.toString();
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${query ? `?${query}` : ""}${url.hash}`,
  );
}

function getPhoneError(phone: SignupPhoneResult) {
  if (!phone.error) return "";
  if (typeof phone.error === "string") return phone.error;
  return phone.error.message ?? "Phone registration failed.";
}

function phoneLabel(phone: SignupPhoneResult) {
  return phone.displayPhoneNumber
    ? `+${phone.displayPhoneNumber}`
    : phone.phoneNumberId;
}

function phaseIndex(phase: ConnectionPhase) {
  if (phase === "error") return -1;

  const index = phaseSteps.findIndex((step) => step.phase === phase);

  return index >= 0 ? index : 0;
}

function OnboardingGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4">
      <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_80px_rgba(8,27,58,0.28)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#BFE9D0] p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
              Meta Embedded Signup
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#081B3A]">
              What your customer will see
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#526173]">
              Meta owns the popup screens. metawhat starts the secure flow,
              records diagnostic events, and saves only the approved account
              details after Meta confirms the signup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#BFE9D0] text-[#526173] transition hover:bg-[#E7F8EF] hover:text-[#081B3A]"
            aria-label="Close onboarding guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[calc(92vh-112px)] overflow-auto p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-2xl border border-[#BFE9D0] bg-[#F8FFFB] p-4">
              <h3 className="text-sm font-bold text-[#081B3A]">
                Official Meta sequence
              </h3>
              <div className="mt-4 space-y-3">
                {metaFlowSteps.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <article
                      key={step.title}
                      className="flex gap-3 rounded-xl border border-[#BFE9D0] bg-white p-3"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-normal text-[#128C7E]">
                          Step {index + 1}
                        </p>
                        <h4 className="mt-1 text-sm font-bold text-[#081B3A]">
                          {step.title}
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-[#526173]">
                          {step.description}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-[#BFE9D0] bg-white p-4">
              <h3 className="text-sm font-bold text-[#081B3A]">
                Before clicking Login
              </h3>
              <ul className="mt-4 space-y-3">
                {readinessChecks.map((check) => (
                  <li
                    key={check}
                    className="flex gap-3 text-xs leading-5 text-[#526173]"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 rounded-xl bg-[#E7F8EF] p-4 text-xs leading-5 text-[#526173] ring-1 ring-[#BFE9D0]">
                If Meta asks for additional display-name or business review,
                the phone may connect but sending limits can stay restricted
                until Meta finishes verification.
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionProgress({ phase }: { phase: ConnectionPhase }) {
  if (phase === "error") {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-rose-700 ring-1 ring-rose-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-rose-700">
              Connection needs attention
            </h3>
            <p className="mt-1 text-xs leading-5 text-rose-700/80">
              Review the message below, fix the configuration or Meta signup
              step, then start the official flow again.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const activeIndex = phaseIndex(phase);

  return (
    <section className="rounded-xl border border-[#BFE9D0] bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {phaseSteps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = activeIndex > index;

          return (
            <div key={step.phase} className="min-w-0">
              <div
                className={[
                  "flex h-full gap-2 rounded-xl border p-3 transition",
                  isActive
                    ? "border-[#128C7E] bg-[#E7F8EF]"
                    : isComplete
                      ? "border-[#BFE9D0] bg-white"
                      : "border-[#DCEEE4] bg-[#F8FFFB]",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                    isComplete
                      ? "bg-[#128C7E] text-white"
                      : isActive
                        ? "bg-white text-[#128C7E] ring-1 ring-[#128C7E]/20"
                        : "bg-[#E7F8EF] text-[#526173]",
                  ].join(" ")}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-[#081B3A]">
                    {step.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[#526173]">
                    {step.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SignupResultModal({
  onClose,
  result,
}: {
  onClose: () => void;
  result: SignupResult;
}) {
  const total = result.phones.length;
  const failed = result.phones.filter((phone) => !phone.success).length;
  const skipped = result.phones.filter((phone) => phone.success && phone.skipped).length;
  const connected = result.phones.filter((phone) => phone.success && !phone.skipped).length;
  const status =
    total === 0
      ? "warning"
      : failed === total
        ? "error"
        : failed > 0 || skipped > 0
          ? "warning"
          : "success";
  const title =
    status === "success"
      ? "Signup completed successfully"
      : status === "warning"
        ? "Signup completed with notes"
        : "Signup failed";
  const description =
    total === 0
      ? "Meta completed the flow but did not return any phone numbers."
      : status === "success"
        ? `${connected} phone number${connected === 1 ? "" : "s"} connected and ready.`
        : `${connected} connected, ${skipped} skipped, ${failed} failed.`;
  const Icon =
    status === "success"
      ? CheckCircle2
      : status === "warning"
        ? AlertTriangle
        : XCircle;
  const iconClass =
    status === "success"
      ? "text-[#15803d]"
      : status === "warning"
        ? "text-[#B7791F]"
        : "text-rose-700";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-[0_24px_80px_rgba(8,27,58,0.28)]">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E7F8EF]">
            <Icon className={`h-6 w-6 ${iconClass}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-[#526173]">
              {description}
            </p>
            {result.webhooksSubscribed ? (
              <p className="mt-2 text-xs font-semibold text-[#15803d]">
                Webhooks subscribed for this WABA.
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 max-h-80 space-y-3 overflow-auto pr-1">
          {result.phones.length === 0 ? (
            <div className="rounded-xl border border-[#BFE9D0] bg-[#E7F8EF] p-4 text-sm text-[#526173]">
              No phone result rows were returned.
            </div>
          ) : (
            result.phones.map((phone) => {
              const rowStatus = !phone.success
                ? "Failed"
                : phone.skipped
                  ? "Skipped"
                  : "Connected";
              const rowClass = !phone.success
                ? "bg-rose-50 text-rose-700 ring-rose-200"
                : phone.skipped
                  ? "bg-[#F8C830]/15 text-[#102040] ring-[#F8C830]/40"
                  : "bg-[#22C55E]/10 text-[#15803d] ring-[#22C55E]/25";

              return (
                <div
                  key={phone.phoneNumberId}
                  className="rounded-xl border border-[#BFE9D0] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#081B3A]">
                        {phoneLabel(phone)}
                      </p>
                      <p className="mt-1 text-xs text-[#526173]">
                        Phone ID: {phone.phoneNumberId}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ring-1 ${rowClass}`}
                    >
                      {rowStatus}
                    </span>
                  </div>

                  {phone.verifiedName || phone.qualityRating ? (
                    <p className="mt-3 text-xs text-[#526173]">
                      {phone.verifiedName || "Unverified name"} · Quality{" "}
                      {phone.qualityRating || "UNKNOWN"}
                    </p>
                  ) : null}

                  {phone.messages?.length ? (
                    <ul className="mt-3 space-y-1 text-xs text-[#526173]">
                      {phone.messages.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  ) : null}

                  {!phone.success ? (
                    <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
                      {getPhoneError(phone)}
                    </p>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={actionButtonClass()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MetaEmbeddedSignupButton({
  graphVersion,
  returnToOnboarding = false,
}: {
  graphVersion: string;
  returnToOnboarding?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [signupResult, setSignupResult] = useState<SignupResult | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [connectionPhase, setConnectionPhase] =
    useState<ConnectionPhase>("idle");
  const signupSessionRef = useRef<SignupSession | null>(null);
  const flowSessionIdRef = useRef<string | null>(null);
  const redirectCallbackHandledRef = useRef(false);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const hasAppId = isConfigured(appId, "your_meta_app_id");
  const hasConfigId = isConfigured(
    configId,
    "your_embedded_signup_config_id",
  );
  const runtimeOriginError = getHttpsRequirementMessage(appUrl);
  const configurationError = !hasAppId
    ? "Meta App ID is not configured."
    : !hasConfigId
      ? "Meta Embedded Signup Configuration ID is not configured."
      : "";
  const visibleError = error || configurationError || runtimeOriginError;

  const saveSignupEvent = useCallback(
    async ({
      currentStep,
      eventType,
      payload,
      phoneNumberId,
      wabaId,
    }: {
      eventType: string;
      currentStep?: string;
      wabaId?: string;
      phoneNumberId?: string;
      payload?: unknown;
    }) => {
      try {
        await fetch("/api/whatsapp/embedded-signup/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            flowSessionId: flowSessionIdRef.current,
            eventType,
            currentStep,
            wabaId,
            phoneNumberId,
            payload,
          }),
        });
      } catch {
        // Signup must continue even if diagnostic event logging fails.
      }
    },
    [],
  );

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isFacebookOrigin(event.origin)) return;

      let parsedData: unknown = event.data;

      if (typeof event.data === "string") {
        try {
          parsedData = JSON.parse(event.data);
        } catch {
          return;
        }
      }

      const signupEvent = extractSignupEvent(parsedData);

      if (!signupEvent) return;

      void saveSignupEvent({
        eventType: signupEvent.event ?? "WA_EMBEDDED_SIGNUP",
        currentStep: signupEvent.currentStep,
        wabaId: signupEvent.session?.wabaId,
        phoneNumberId: signupEvent.session?.phoneNumberId,
        payload: parsedData,
      });

      if (signupEvent.event === "ERROR") {
        setConnectionPhase("error");
        setIsConnecting(false);
        setError(
          signupEvent.errorMessage ??
            "Meta Embedded Signup returned an error. Please try again.",
        );
        return;
      }

      if (signupEvent.event === "CANCEL") {
        setConnectionPhase("error");
        setIsConnecting(false);
        setError(
          signupEvent.currentStep
            ? `Meta signup was cancelled at ${signupEvent.currentStep}.`
            : "Meta signup was cancelled.",
        );
        return;
      }

      if (signupEvent.session) {
        setConnectionPhase("waiting");
        signupSessionRef.current = signupEvent.session;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveSignupEvent]);

  const completeConnection = useCallback(async (code: string, session: SignupSession) => {
    setIsConnecting(true);
    setConnectionPhase("saving");
    setError("");

    try {
      const response = await fetch("/api/whatsapp/embedded-signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          flowSessionId: flowSessionIdRef.current,
          wabaId: session.wabaId,
          phoneNumberId: session.phoneNumberId,
          redirectUri: getCanonicalConnectRedirectUri(appUrl),
        }),
      });
      const data = (await response.json()) as ConnectResponse;

      if (!response.ok) {
        setConnectionPhase("error");
        setError(data.message ?? "Unable to complete WhatsApp connection.");
        return;
      }

      const fallbackPhone =
        data.connection?.phoneNumberId && session.phoneNumberId
          ? [
              {
                phoneNumberId: data.connection.phoneNumberId,
                displayPhoneNumber: data.connection.displayPhoneNumber,
                verifiedName: data.connection.verifiedName,
                qualityRating: data.connection.qualityRating,
                success: true,
                skipped: false,
                messages: ["Selected phone number connected"],
                error: null,
              },
            ]
          : [];

      setSignupResult({
        phones: data.connection?.phones?.length
          ? data.connection.phones
          : fallbackPhone,
        webhooksSubscribed: data.connection?.webhooksSubscribed,
      });
      setConnectionPhase("done");
      router.refresh();
    } catch {
      setConnectionPhase("error");
      setError("Unable to complete WhatsApp connection.");
    } finally {
      setIsConnecting(false);
    }
  }, [appUrl, router]);

  const handleHostedOnboardingError = useCallback(
    (message: string, errorCode: string | null) => {
      setConnectionPhase("error");
      setIsConnecting(false);
      setError(message);
      void saveSignupEvent({
        eventType: "HOSTED_ONBOARDING_REDIRECT_ERROR",
        payload: {
          hasError: true,
          errorCode,
          error: message,
        },
      });
    },
    [saveSignupEvent],
  );

  useEffect(() => {
    if (redirectCallbackHandledRef.current) return;

    const code = searchParams.get("code");
    const metaError =
      searchParams.get("error_message") ??
      searchParams.get("error_description") ??
      searchParams.get("error");

    if (!code && !metaError) return;

    redirectCallbackHandledRef.current = true;
    flowSessionIdRef.current = searchParams.get("state") || createFlowSessionId();

    if (metaError) {
      const errorCode = searchParams.get("error_code");
      window.setTimeout(() => {
        handleHostedOnboardingError(metaError, errorCode);
      }, 0);
      clearHostedOnboardingQuery();
      return;
    }

    if (!code) return;

    const session = getRedirectSignupSession(searchParams);

    void saveSignupEvent({
      eventType: "HOSTED_ONBOARDING_CODE_RECEIVED",
      wabaId: session.wabaId,
      phoneNumberId: session.phoneNumberId,
      payload: {
        hasCode: true,
        hasWabaId: Boolean(session.wabaId),
        hasPhoneNumberId: Boolean(session.phoneNumberId),
        flow: "business_facebook_onboard_redirect",
      },
    });
    clearHostedOnboardingQuery();
    window.setTimeout(() => {
      void completeConnection(code, session);
    }, 0);
  }, [completeConnection, handleHostedOnboardingError, saveSignupEvent, searchParams]);

  function startEmbeddedSignup() {
    setError("");
    setSignupResult(null);
    setConnectionPhase("idle");
    signupSessionRef.current = null;
    flowSessionIdRef.current = createFlowSessionId();

    void saveSignupEvent({
      eventType: "CLIENT_FLOW_STARTED",
      payload: {
        graphVersion,
        hasConfigId,
        browserOrigin: window.location.origin,
        tokenExchangeStrategy: "hosted_redirect_with_redirect_uri",
      },
    });

    if (!hasAppId || !appId) {
      setConnectionPhase("error");
      setError("Meta App ID is not configured.");
      return;
    }

    if (window.location.protocol !== "https:") {
      setConnectionPhase("error");
      setError(
        appUrl?.startsWith("https://")
          ? `Facebook Login requires HTTPS. Open this page from ${appUrl}/dashboard/whatsapp/connect.`
            : "Facebook Login requires HTTPS. Open this page from your ngrok HTTPS URL.",
      );
      return;
    }

    if (!hasConfigId || !configId) {
      setConnectionPhase("error");
      setError("Meta Embedded Signup Configuration ID is not configured.");
      return;
    }

    setIsConnecting(true);
    setConnectionPhase("opening");

    try {
      const hostedUrl = getHostedOnboardingUrl({
        appId,
        configId,
        flowSessionId: flowSessionIdRef.current,
        redirectUri: getCanonicalConnectRedirectUri(appUrl),
      });

      void saveSignupEvent({
        eventType: "HOSTED_ONBOARDING_REDIRECT_STARTED",
        payload: {
          hasConfigId,
          graphVersion,
          redirectUri: getCanonicalConnectRedirectUri(appUrl),
          featureType: "whatsapp_business_app_onboarding",
        },
      });

      window.location.assign(hostedUrl);
    } catch {
      setConnectionPhase("error");
      setIsConnecting(false);
      setError("Unable to start Meta-hosted WhatsApp onboarding.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setIsGuideOpen(true)}
          className={actionButtonClass("secondary")}
        >
          <BookOpen className="mr-2 h-4 w-4" />
          Onboarding Guide
        </button>

        <button
          type="button"
          onClick={startEmbeddedSignup}
          disabled={
            isConnecting ||
            Boolean(configurationError) ||
            Boolean(runtimeOriginError)
          }
          className={actionButtonClass()}
        >
          {isConnecting ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          {isConnecting ? "Connecting..." : "Login with Facebook"}
        </button>
      </div>

      <ConnectionProgress phase={connectionPhase} />

      <div className="grid gap-3 rounded-xl border border-[#BFE9D0] bg-[#F8FFFB] p-4 text-xs leading-5 text-[#526173] sm:grid-cols-3">
        <div className="flex gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
          <span>Official Meta-hosted onboarding opens in a secure flow.</span>
        </div>
        <div className="flex gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
          <span>Access token is exchanged server-side and encrypted.</span>
        </div>
        <div className="flex gap-2">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#128C7E]" />
          <span>
            Phone number, WABA, and webhook status are saved after success.
          </span>
        </div>
      </div>

      {visibleError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <p>{visibleError}</p>
        </div>
      ) : null}

      {signupResult ? (
        <SignupResultModal
          result={signupResult}
          onClose={() => {
            setSignupResult(null);
            router.push(
              returnToOnboarding ? "/dashboard/onboarding" : "/dashboard/whatsapp",
            );
            router.refresh();
          }}
        />
      ) : null}

      {isGuideOpen ? (
        <OnboardingGuideModal onClose={() => setIsGuideOpen(false)} />
      ) : null}
    </div>
  );
}
