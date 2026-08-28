export function encryptAuthenticatedString(
  key: Uint8Array,
  value: string,
  associatedData: string,
): string;

export function decryptAuthenticatedString(
  key: Uint8Array,
  serializedEnvelope: string,
  associatedData: string,
): string;
