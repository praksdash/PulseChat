export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 60;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 32;
export const BIO_MAX = 160;

export function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase();
}

export function validateDisplayName(value: string) {
  const length = value.trim().length;
  if (length < DISPLAY_NAME_MIN) return 'Display name must be at least 2 characters.';
  if (length > DISPLAY_NAME_MAX) return 'Display name must be 60 characters or fewer.';
  return null;
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!normalized) return null;
  if (normalized.length < USERNAME_MIN || normalized.length > USERNAME_MAX) {
    return 'Username must be 3–32 characters.';
  }
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    return 'Use only lowercase letters, numbers and underscores.';
  }
  return null;
}

export function validateBio(value: string) {
  if (value.trim().length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or fewer.`;
  return null;
}
