"use client";

import { LoaderCircle, LogIn, RotateCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

type ConnectResponse = {
  message?: string;
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

  if (root.type !== "WA_EMBEDDED_SIGNUP") return null;

  const data = root.data;

  if (!data || typeof data !== "object") {
    return {
      event: stringValue(root.event),
      session: null,
    };
  }

  const signupData = data as Record<string, unknown>;
  const wabaId = stringValue(signupData.waba_id) ?? stringValue(signupData.wabaId);
  const phoneNumberId =
    stringValue(signupData.phone_number_id) ??
    stringValue(signupData.phoneNumberId);

  return {
    event: stringValue(root.event),
    session:
      wabaId || phoneNumberId
        ? {
            wabaId,
            phoneNumberId,
          }
        : null,
    currentStep: stringValue(signupData.current_step),
    errorMessage: stringValue(signupData.error_message),
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
  const signupSessionRef = useRef<SignupSession | null>(null);

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
  const canRetrySdkLoad = error === getSdkBlockedMessage();

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
  }, []);

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
          wabaId: session.wabaId,
          phoneNumberId: session.phoneNumberId,
        }),
      });
      const data = (await response.json()) as ConnectResponse;

      if (!response.ok) {
        setError(data.message ?? "Unable to complete WhatsApp connection.");
        return;
      }

      router.push("/dashboard/whatsapp");
      router.refresh();
    } catch {
      setError("Unable to complete WhatsApp connection.");
    } finally {
      setIsConnecting(false);
    }
  }

  function startEmbeddedSignup() {
    setError("");
    signupSessionRef.current = null;

    if (!window.FB || !isSdkReady) {
      setError("Facebook SDK is not ready yet.");
      return;
    }

    if (window.location.protocol !== "https:") {
      setError(
        appUrl?.startsWith("https://")
          ? `Facebook Login requires HTTPS. Open this page from ${appUrl}/dashboard/whatsapp/connect.`
          : "Facebook Login requires HTTPS. Open this page from your ngrok HTTPS URL.",
      );
      return;
    }

    if (!hasConfigId || !configId) {
      setError("Meta Embedded Signup Configuration ID is not configured.");
      return;
    }

    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;

        if (!code) {
          setError("Meta signup was cancelled or returned no authorization code.");
          return;
        }

        void waitForSignupSession(signupSessionRef).then((session) => {
          if (!session?.wabaId || !session.phoneNumberId) {
            setError(getMissingSessionMessage(session));
            return;
          }

          void completeConnection(code, session);
        });
      },
      {
        config_id: configId,
        auth_type: "rerequest",
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: 3 },
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
    </div>
  );
}
