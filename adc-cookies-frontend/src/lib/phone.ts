/*
 * One place that turns whatever a customer typed into the 10 digits we actually store.
 *
 * WHY THIS EXISTS. Every phone input used to do `.replace(/\D/g,'').slice(0, 10)`, which keeps the
 * FIRST ten digits. A customer who types their number with the country code — a common habit, and
 * our fields even show "+91" beside the box — had it silently turned into a different number:
 *
 *     typed  919886641164
 *     kept   9198866411      ← ten digits, starts with 9, passes every validator we have
 *
 * That is not a typo the customer can see, and no regex can catch it: a shifted number is
 * shape-identical to a real one. It cost a real customer their login OTP and put a wrong number on
 * a live delivery — the rider's number and the delivery OTP both come from that field.
 *
 * The backend's normalizePhone() has always handled this correctly, but it never got the chance:
 * the browser cut the digits to ten before the server ever saw twelve.
 */

/**
 * The 10-digit national number, stripping a country code or trunk prefix FIRST.
 *
 * Safe to call on every keystroke. The strip only fires once the input is longer than 10 digits,
 * so a real number that happens to begin "91" is untouched while it is being typed, and a pasted
 * "+91 98866 41164" collapses correctly.
 */
export function tenDigit(input: string | null | undefined): string {
  let d = String(input ?? '').replace(/\D/g, '');
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2);
  else if (d.length > 10 && d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

/** True for a number India will actually deliver an SMS to. */
export function isMobile(input: string | null | undefined): boolean {
  return /^[6-9]\d{9}$/.test(tenDigit(input));
}

/**
 * "+91 98866 41164" — grouped, so a shifted number looks wrong at a glance.
 * Returns '' rather than a half-formatted string while the field is still being filled.
 */
export function formatPhone(input: string | null | undefined): string {
  const t = tenDigit(input);
  return t.length === 10 ? `+91 ${t.slice(0, 5)} ${t.slice(5)}` : '';
}
