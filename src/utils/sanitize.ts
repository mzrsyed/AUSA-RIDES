export const ADMIN_EMAIL = 'mzrsyed@gmail.com';

export function isAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === ADMIN_EMAIL);
}

/**
 * Strips HTML angle brackets, quotes, script control characters, and trims length
 * to prevent XSS payloads before storing user-entered text in Firestore.
 */
export function sanitizeText(input: string, maxLength: number): string {
  return input
    .replace(/[<>`"'&\\]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates and normalizes 10-digit Indian mobile numbers into +91XXXXXXXXXX.
 * Returns null if invalid.
 */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  let tenDigits = '';

  if (digits.length === 10) {
    tenDigits = digits;
  } else if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  } else {
    return null;
  }

  if (!/^[6-9][0-9]{9}$/.test(tenDigits)) {
    return null;
  }

  return `+91${tenDigits}`;
}

/**
 * Validates and normalizes Latur/Ausa RTO MH-24 auto-rickshaw number plates
 * into canonical MH-24-XX-1234 format.
 */
export function normalizeVehiclePlate(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = cleaned.match(/^(MH)(24)([A-Z]{1,2})([0-9]{4})$/);
  if (!match) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}-${match[4]}`;
}

/**
 * Validates and normalizes Indian Driving License number (e.g. MH24-20190012345).
 */
export function normalizeLicenseNumber(input: string): string | null {
  const cleaned = input
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
  if (cleaned.length < 8 || !/^[A-Z0-9-]+$/.test(cleaned)) {
    return null;
  }
  return cleaned;
}

export function generateFourDigitPin(): string {
  const array = new Uint32Array(1);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
    return String(1000 + (array[0] % 9000));
  }
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
