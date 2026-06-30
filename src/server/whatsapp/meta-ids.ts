export const META_NUMERIC_ID_PATTERN = /^\d+$/;

export const NUMERIC_WABA_ID_MESSAGE =
  "WABA ID must be the numeric WhatsApp Business Account ID from Meta. Do not use a local dev ID like dev-waba-...";

export const NUMERIC_PHONE_NUMBER_ID_MESSAGE =
  "Phone Number ID must be the numeric WhatsApp phone number ID from Meta.";

export function isMetaNumericId(value: string | null | undefined) {
  return Boolean(value && META_NUMERIC_ID_PATTERN.test(value.trim()));
}
