"use client";

import { LoaderCircle, LogIn } from "lucide-react";
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

function extractSignupSession(eventData: unknown): SignupSession | null {
  if (!eventData || typeof eventData !== "object") return null;

  const root = eventData as Record<string, unknown>;

  if (root.type !== "WA_EMBEDDED_SIGNUP") return null;
  if (typeof root.event === "string" && root.event !== "FINISH") return null;

  const data = root.data;

  if (!data || typeof data !== "object") return null;

  const signupData = data as Record<string, unknown>;

  return {
    wabaId:
      typeof signupData.waba_id === "string"
        ? signupData.waba_id
        : typeof signupData.wabaId === "string"
          ? signupData.wabaId
          : undefined,
    phoneNumberId:
      typeof signupData.phone_number_id === "string"
        ? signupData.phone_number_id
        : typeof signupData.phoneNumberId === "string"
          ? signupData.phoneNumberId
          : undefined,
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

      if (Date.now() - startedAt >= 5000) {
        window.clearInterval(interval);
        resolve(null);
      }
    }, 100);
  });
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
  const signupSessionRef = useRef<SignupSession | null>(null);

  const appId = process.env.NEXT_PUBLIC_META_APP_ID;
  const configId = process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID;
  const hasAppId = isConfigured(appId, "your_meta_app_id");
  const hasConfigId = isConfigured(
    configId,
    "your_embedded_signup_config_id",
  );
  const configurationError = !hasAppId
    ? "Meta App ID is not configured."
    : !hasConfigId
      ? "Meta Embedded Signup Configuration ID is not configured."
      : "";
  const visibleError = error || configurationError;

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

      const session = extractSignupSession(parsedData);

      if (session?.wabaId && session.phoneNumberId) {
        signupSessionRef.current = session;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!hasAppId || !appId) return;

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

    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.onerror = () => setError("Unable to load the Facebook SDK.");
      document.body.appendChild(script);
    }
  }, [appId, graphVersion, hasAppId]);

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
          if (!session) {
            setError(
              "Meta did not return the WABA and phone number details. Please try again.",
            );
            return;
          }

          void completeConnection(code, session);
        });
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { sessionInfoVersion: "3" },
      },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={startEmbeddedSignup}
        disabled={!isSdkReady || isConnecting || Boolean(configurationError)}
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
        <p
          role="alert"
          className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
        >
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}
