const DOMAIN = import.meta.env.VITE_PHONE_EMAIL_DOMAIN ?? "wholesale.local";

/**
 * Strip everything except digits. Customers may enter phones with spaces,
 * +91 prefix, dashes, etc. We always store the canonical 10-digit form.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, "");
  // If user typed "+91 9876543210" we get "919876543210". Drop a leading "91"
  // for Indian numbers so we always end up with the 10-digit national number.
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isValidPhone(raw: string): boolean {
  const n = normalizePhone(raw);
  return /^[6-9]\d{9}$/.test(n);
}

/**
 * Map a phone number to the synthetic email Supabase Auth uses internally.
 * We do NOT use Supabase's phone+OTP flow (which costs SMS credits) — instead
 * we register every customer as `<phone>@<domain>` with a password the owner
 * sets. From the user's POV they log in with phone + password.
 */
export function phoneToEmail(phone: string): string {
  return `${normalizePhone(phone)}@${DOMAIN}`;
}

export function emailToPhone(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 0) return email;
  return email.slice(0, at);
}

export function formatPhone(phone: string): string {
  const n = normalizePhone(phone);
  if (n.length === 10) return `${n.slice(0, 5)} ${n.slice(5)}`;
  return phone;
}
