/*
 * What the outbound clients hand back.
 *
 * Every one of delhivery / shiprocket / razorpay / petpooja / geo / messageCentral answers in the
 * same shape — `{ ok: false, reason }` on failure, `{ ok: true, ...whatever that call returns }`
 * on success — because none of them throws. They are called on the paid-order path, where an
 * exception would unwind into a 500 and leave a customer charged with no parcel, so a failure has
 * to come back as a value the caller can record.
 *
 * The index signature is deliberate and is a MIGRATION-STAGE type, not an aspiration. These
 * successes carry wildly different payloads (a waybill, an AWB, a token, a rate card), and writing
 * a discriminated union per call would mean rewriting call sites — which is precisely the risk this
 * migration is meant to avoid. `ok` and `reason` are known and checked; the payload is not, yet.
 *
 * Tightening one client at a time, by giving that client its own union, is the obvious next step
 * and can be done without touching any other.
 */
export interface ClientResult {
  ok: boolean;
  reason?: string;
  [key: string]: any;
}
