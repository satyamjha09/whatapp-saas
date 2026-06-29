export const COMPANY_ONBOARDING_STATE_CACHE_TAG = "company-onboarding-state";
export const COMPANY_PLAN_ACCESS_CACHE_TAG = "company-plan-access";
export const COMPANY_FEATURE_ACCESS_CACHE_TAG = "company-feature-access";
export const TRUST_CENTER_DOCUMENTS_CACHE_TAG = "trust-center-documents";
export const TRUST_CENTER_ACCEPTANCE_CACHE_TAG = "trust-center-acceptance";

export function companyOnboardingStateCacheTag(companyId: string) {
  return `company:${companyId}:onboarding-state`;
}

export function companyPlanAccessCacheTag(companyId: string) {
  return `company:${companyId}:plan-access`;
}

export function companyFeatureAccessCacheTag(companyId: string) {
  return `company:${companyId}:feature-access`;
}

export function companyTrustAcceptanceCacheTag(companyId: string) {
  return `company:${companyId}:trust-acceptance`;
}
