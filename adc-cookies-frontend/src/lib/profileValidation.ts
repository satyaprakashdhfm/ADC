// Shared "is this a real, proper name/email" bar — used everywhere we ask for profile details
// (the OTP mandatory step, email/password sign-up, and the post-login ProfileGate), so the
// standard is identical no matter which login method got someone here.

// Rejects junk like "123@gmail.com" (digits-only local part) — requires a real-looking local
// part (at least one letter, 2+ characters) and a proper domain/TLD.
export const EMAIL_RE = /^(?=[^\s@]*[a-zA-Z])[^\s@]{2,}@[^\s@]+\.[a-zA-Z]{2,}$/;

/*
 * Two, not five.
 *
 * This was 5, which quietly turned away anybody called Ram, Raj, Anu, Om or Dev — ordinary names,
 * and the customer got no message at all, only a Continue button that would not respond. The
 * length was standing in for "give us your full name", which it never actually enforced: "Ramaa"
 * passed and "Ram K" passed, so it rejected real single names while letting through exactly the
 * half-names it was meant to stop.
 *
 * So the bar is now only what we genuinely need: something with letters in it that is not the
 * placeholder. Anything stricter is a guess about how people are named, and we get that wrong.
 */
export const MIN_NAME_LEN = 2;

/** Names are for addressing people, so they must contain letters — "12" and "..." are not names. */
const HAS_LETTER = /\p{L}/u;

// 'guest' is the placeholder name new phone-OTP accounts start with — a length check alone lets it
// slip through as "valid" and silently skip asking for a real name.
export const isValidName = (name: string | null | undefined) => nameError(name) === null && !!(name || '').trim();

export const isValidEmail = (email: string | null | undefined) => EMAIL_RE.test((email || '').trim());

/*
 * WHY a value is not acceptable, in words a customer can act on.
 *
 * Every form using these had the same shape: an invalid value disabled the submit button and said
 * nothing. That is indistinguishable from a broken page — you cannot tell whether the site is
 * stuck, your typing did not register, or something you entered is wrong. A rejection has to say
 * what to change.
 *
 * Returns null when the field is EMPTY as well as when it is valid: nobody needs to be told their
 * name is too short before they have finished typing it.
 */
export function nameError(name: string | null | undefined): string | null {
  const n = (name || '').trim();
  if (!n) return null;
  if (n.toLowerCase() === 'guest') return 'Please enter your own name so we know who to hand the order to.';
  if (!HAS_LETTER.test(n)) return 'Please enter your name using letters.';
  if (n.length < MIN_NAME_LEN) return `Please enter at least ${MIN_NAME_LEN} letters.`;
  return null;
}

export function emailError(email: string | null | undefined): string | null {
  const e = (email || '').trim();
  if (!e) return null;
  if (!e.includes('@')) return 'An email address needs an @ — for example you@example.com.';
  if (!EMAIL_RE.test(e)) return 'That email does not look right. Check for a typo.';
  return null;
}
