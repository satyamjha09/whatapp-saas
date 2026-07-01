"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  LogIn,
  RotateCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { actionButtonClass } from "@/app/dashboard/dashboard-ui";

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: {
      init: (options: {
        appId: string;
        autoLogAppEvents: boolean;
        xfbml: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        options: Record<string, unknown>,
      ) => void;
    };
  }
}

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

function waitForSignupSession(
  sessionRef: React.RefObject<SignupSession | null>,
) {
  return new Promise<SignupSession | null>((resolve) => {
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const session = sessionRef.current;

      if (session?.wabaId && session.phoneNumberId) {
        window.clearInterval(interval);
        resolve(session);
        return;
      }

      if (Date.now() - startedAt >= 15000) {
        window.clearInterval(interval);
        resolve(session ?? null);
      }
    }, 100);
  });
}

function getMissingSessionMessage(session: SignupSession | null) {
  if (session?.wabaId && !session.phoneNumberId) {
    return "Meta returned the WhatsApp Business Account but no phone number. Please select or create a phone number before finishing signup.";
  }

  if (!session?.wabaId && session?.phoneNumberId) {
    return "Meta returned a phone number but no WhatsApp Business Account. Please select the correct WhatsApp Business Account and try again.";
  }

  return "Meta did not return the WABA and phone number details. Please try again.";
}

function getHttpsRequirementMessage(appUrl: string | undefined) {
  if (typeof window === "undefined" || window.location.protocol === "https:") {
    return "";
  }

  return appUrl?.startsWith("https://")
    ? `Facebook Login requires HTTPS. Open this page from ${appUrl}/dashboard/whatsapp/connect.`
    : "Facebook Login requires HTTPS. Open this page from your ngrok HTTPS URL.";
}

function getSdkBlockedMessage() {
  return "Unable to load the Facebook SDK. Disable ad blockers or browser tracking protection for this site, then retry.";
}

function getOAuthRedirectUri({
  appUrl,
  configuredRedirectUri,
}: {
  appUrl: string | undefined;
  configuredRedirectUri: string | undefined;
}) {
  try {
    if (configuredRedirectUri?.startsWith("https://")) {
      return configuredRedirectUri;
    }

    if (appUrl?.startsWith("https://")) {
      return `${new URL(appUrl).origin}/dashboard/whatsapp/connect`;
    }

    if (typeof window !== "undefined") {
      return `${window.location.origin}/dashboard/whatsapp/connect`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function createFlowSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDialogOAuthDebugPayload(url: string | URL | undefined) {
  if (!url) return null;

  try {
    const rawUrl = url.toString();

    if (!rawUrl.includes("facebook.com") || !rawUrl.includes("dialog/oauth")) {
      return null;
    }

    const parsedUrl = new URL(rawUrl);

    return {
      href: rawUrl,
      redirectUri: parsedUrl.searchParams.get("redirect_uri"),
      fallbackRedirectUri: parsedUrl.searchParams.get("fallback_redirect_uri"),
      responseType: parsedUrl.searchParams.get("response_type"),
      overrideDefaultResponseType: parsedUrl.searchParams.get(
        "override_default_response_type",
      ),
    };
  } catch {
    return null;
  }
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
}: {
  graphVersion: string;
}) {
  const router = useRouter();
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState("");
  const [sdkLoadAttempt, setSdkLoadAttempt] = useState(0);
  const [signupResult, setSignupResult] = useState<SignupResult | null>(null);
  const signupSessionRef = useRef<SignupSession | null>(null);
  const flowSessionIdRef = useRef<string | null>(null);
  const oauthDialogRedirectUriRef = useRef<string | null>(null);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const configuredRedirectUri = process.env.NEXT_PUBLIC_META_REDIRECT_URI;
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
  const oauthRedirectUri = getOAuthRedirectUri({
    appUrl,
    configuredRedirectUri,
  });
  const visibleError = error || configurationError || runtimeOriginError;
  const canRetrySdkLoad = error === getSdkBlockedMessage();

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
        setError(
          signupEvent.errorMessage ??
            "Meta Embedded Signup returned an error. Please try again.",
        );
        return;
      }

      if (signupEvent.event === "CANCEL") {
        setError(
          signupEvent.currentStep
            ? `Meta signup was cancelled at ${signupEvent.currentStep}.`
            : "Meta signup was cancelled.",
        );
        return;
      }

      if (signupEvent.session) {
        signupSessionRef.current = signupEvent.session;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [saveSignupEvent]);

  useEffect(() => {
    if (!hasAppId || !appId) return;
    let loadTimeout: number | null = null;

    function initializeSdk() {
      window.FB?.init({
        appId: appId as string,
        autoLogAppEvents: true,
        xfbml: true,
        version: graphVersion,
      });
      setIsSdkReady(Boolean(window.FB));
    }

    window.fbAsyncInit = initializeSdk;

    if (window.FB) {
      initializeSdk();
      return;
    }

    document.getElementById("facebook-jssdk")?.remove();

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.onload = () => {
      if (window.FB) initializeSdk();
    };
    script.onerror = () => setError(getSdkBlockedMessage());
    document.body.appendChild(script);

    loadTimeout = window.setTimeout(() => {
      if (!window.FB) {
        setError(getSdkBlockedMessage());
      }
    }, 8000);

    return () => {
      if (loadTimeout) window.clearTimeout(loadTimeout);
    };
  }, [appId, graphVersion, hasAppId, sdkLoadAttempt]);

  function retrySdkLoad() {
    setError("");
    setIsSdkReady(false);
    setSdkLoadAttempt((attempt) => attempt + 1);
  }

  async function completeConnection(code: string, session: SignupSession) {
    setIsConnecting(true);
    setError("");

    try {
      const response = await fetch("/api/whatsapp/embedded-signup/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          flowSessionId: flowSessionIdRef.current,
          redirectUri: oauthDialogRedirectUriRef.current ?? oauthRedirectUri,
          wabaId: session.wabaId,
          phoneNumberId: session.phoneNumberId,
        }),
      });
      const data = (await response.json()) as ConnectResponse;

      if (!response.ok) {
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
      router.refresh();
    } catch {
      setError("Unable to complete WhatsApp connection.");
    } finally {
      setIsConnecting(false);
    }
  }

  function startEmbeddedSignup() {
    setError("");
    setSignupResult(null);
    signupSessionRef.current = null;
    oauthDialogRedirectUriRef.current = null;
    flowSessionIdRef.current = createFlowSessionId();
    const originalWindowOpen = window.open.bind(window);
    let windowOpenRestored = false;

    function restoreWindowOpen() {
      if (windowOpenRestored) return;

      window.open = originalWindowOpen;
      windowOpenRestored = true;
    }

    void saveSignupEvent({
      eventType: "CLIENT_FLOW_STARTED",
      payload: {
        graphVersion,
        hasConfigId,
        redirectUri: oauthRedirectUri,
        fallbackRedirectUri: oauthRedirectUri,
      },
    });

    if (!window.FB || !isSdkReady) {
      setError("Facebook SDK is not ready yet.");
      restoreWindowOpen();
      return;
    }

    if (window.location.protocol !== "https:") {
      setError(
        appUrl?.startsWith("https://")
          ? `Facebook Login requires HTTPS. Open this page from ${appUrl}/dashboard/whatsapp/connect.`
          : "Facebook Login requires HTTPS. Open this page from your ngrok HTTPS URL.",
      );
      restoreWindowOpen();
      return;
    }

    if (!hasConfigId || !configId) {
      setError("Meta Embedded Signup Configuration ID is not configured.");
      restoreWindowOpen();
      return;
    }

    window.open = ((url?: string | URL, target?: string, features?: string) => {
      const debugPayload = getDialogOAuthDebugPayload(url);

      if (debugPayload) {
        oauthDialogRedirectUriRef.current = debugPayload.redirectUri;

        void saveSignupEvent({
          eventType: "CLIENT_OAUTH_DIALOG_OPENED",
          payload: debugPayload,
        });
      }

      return originalWindowOpen(url, target, features);
    }) as typeof window.open;

    window.setTimeout(restoreWindowOpen, 3000);

    window.FB.login(
      (response) => {
        restoreWindowOpen();
        const code = response.authResponse?.code;

        void saveSignupEvent({
          eventType: code ? "FB_LOGIN_CODE_RECEIVED" : "FB_LOGIN_CANCELLED",
          payload: {
            status: response.status,
            hasCode: Boolean(code),
          },
        });

        if (!code) {
          setError("Meta signup was cancelled or returned no authorization code.");
          return;
        }

        void waitForSignupSession(signupSessionRef).then((session) => {
          if (!session?.wabaId || !session.phoneNumberId) {
            const message = getMissingSessionMessage(session);

            void saveSignupEvent({
              eventType: "CLIENT_SESSION_MISSING",
              wabaId: session?.wabaId,
              phoneNumberId: session?.phoneNumberId,
              payload: { message, fallback: "server_discovery" },
            });
            void completeConnection(code, session ?? {});
            return;
          }

          void completeConnection(code, session);
        });
      },
      {
        config_id: configId,
        auth_type: "rerequest",
        redirect_uri: oauthRedirectUri,
        fallback_redirect_uri: oauthRedirectUri,
        scope:
          "business_management,whatsapp_business_management,whatsapp_business_messaging",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          version: "v4",
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={startEmbeddedSignup}
        disabled={
          !isSdkReady ||
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

      {!isSdkReady && !visibleError ? (
        <p className="mt-3 text-xs text-[#526173]">Loading Facebook SDK...</p>
      ) : null}

      {visibleError ? (
        <div
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          <p>{visibleError}</p>
          {canRetrySdkLoad ? (
            <button
              type="button"
              onClick={retrySdkLoad}
              className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
            >
              <RotateCw className="mr-2 h-3.5 w-3.5" />
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {signupResult ? (
        <SignupResultModal
          result={signupResult}
          onClose={() => {
            setSignupResult(null);
            router.push("/dashboard/whatsapp");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
