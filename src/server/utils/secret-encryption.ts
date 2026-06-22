import { decryptText, encryptText } from "@/lib/encryption";

export function encryptSecret(value: string) {
  return encryptText(value);
}

export function decryptSecret(value: string) {
  return decryptText(value);
}
