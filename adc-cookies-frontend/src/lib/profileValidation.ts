// Shared "is this a real, proper name/email" bar — used everywhere we ask for profile details
// (the OTP mandatory step, email/password sign-up, and the post-login ProfileGate), so the
// standard is identical no matter which login method got someone here.

// Rejects junk like "123@gmail.com" (digits-only local part) — requires a real-looking local
// part (at least one letter, 2+ characters) and a proper domain/TLD.
export const EMAIL_RE = /^(?=[^\s@]*[a-zA-Z])[^\s@]{2,}@[^\s@]+\.[a-zA-Z]{2,}$/;
export const MIN_NAME_LEN = 5;

// 'guest' is the placeholder name new phone-OTP accounts start with — it's 5 characters, so the
// length check alone lets it slip through as "valid" and silently skip asking for a real name.
export const isValidName = (name: string | null | undefined) => {
  const n = (name || '').trim();
  return n.length >= MIN_NAME_LEN && n.toLowerCase() !== 'guest';
};
export const isValidEmail = (email: string | null | undefined) => EMAIL_RE.test((email || '').trim());
