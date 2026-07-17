// Shared "is this a real, proper name/email" bar — used everywhere we ask for profile details
// (the OTP mandatory step, email/password sign-up, and the post-login ProfileGate), so the
// standard is identical no matter which login method got someone here.

// Rejects junk like "123@gmail.com" (digits-only local part) — requires a real-looking local
// part (at least one letter, 2+ characters) and a proper domain/TLD.
export const EMAIL_RE = /^(?=[^\s@]*[a-zA-Z])[^\s@]{2,}@[^\s@]+\.[a-zA-Z]{2,}$/;
export const MIN_NAME_LEN = 5;

export const isValidName = (name: string | null | undefined) => (name || '').trim().length >= MIN_NAME_LEN;
export const isValidEmail = (email: string | null | undefined) => EMAIL_RE.test((email || '').trim());
