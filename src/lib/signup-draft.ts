export const SIGNUP_COMPANY_DRAFT_KEY = "tallykonnect.signup.companyDraft.v1";

export type SignupCompanyDraft = {
  businessName: string;
  businessCategory: string;
  personalName: string;
  email: string;
  mobile: string;
  city: string;
  pinCode: string;
  channelPartner?: string | null;
  employeeCode?: string | null;
  whatsappUpdatesConsent: boolean;
};

export function saveSignupCompanyDraft(draft: SignupCompanyDraft) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(SIGNUP_COMPANY_DRAFT_KEY, JSON.stringify(draft));
}

export function getSignupCompanyDraft(): SignupCompanyDraft | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(SIGNUP_COMPANY_DRAFT_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as SignupCompanyDraft;
  } catch {
    return null;
  }
}

export function clearSignupCompanyDraft() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(SIGNUP_COMPANY_DRAFT_KEY);
}
