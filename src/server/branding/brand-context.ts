export type BrandContext = {
  source: "default" | "partner";
  partnerCompanyId: string | null;
  appName: string;
  companyName: string;
  logoUrl: string;
  logoDarkUrl: string;
  markUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  supportName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  loginHeading: string;
  loginDescription: string;
  hideMetaWhatBranding: boolean;
};

export const DEFAULT_BRAND_CONTEXT: BrandContext = {
  source: "default",
  partnerCompanyId: null,
  appName: "metawhat",
  companyName: "MetaWhat",
  logoUrl: "/brand/metawhat-logo-white.png",
  logoDarkUrl: "/brand/metawhat-logo-white.png",
  markUrl: "/brand/metawhat-mark.png",
  faviconUrl: "/brand/metawhat-mark.png",
  primaryColor: "#128C7E",
  secondaryColor: "#25D366",
  accentColor: "#4F46E5",
  backgroundColor: "#E7F8EF",
  textColor: "#081B3A",
  supportName: "MetaWhat Support",
  supportEmail: null,
  supportPhone: null,
  loginHeading: "Run WhatsApp growth from one workspace",
  loginDescription:
    "Connect WhatsApp, create templates, import contacts, send campaigns, and measure every reply.",
  hideMetaWhatBranding: false,
};
