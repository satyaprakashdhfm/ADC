import type { Request, Response, NextFunction } from 'express';

/*
 * What a shared cache — Railway's CDN, or any proxy in front of us — is allowed to keep.
 *
 * THE RULE IS DENY BY DEFAULT, and it exists because of a specific, checkable hazard.
 *
 * Railway's CDN caches a GET/HEAD response unless the request carries an `Authorization` header or
 * the response forbids it. The customer API and the store portal both authenticate with
 * `Authorization: Bearer`, so the edge excludes them on its own. The ADMIN API does not — it
 * authenticates with `X-Admin-Token` (see adminAuth.service.ts), which the edge has no reason to
 * treat as special — and this backend set no Cache-Control headers at all.
 *
 * So switching CDN caching on would have made `GET /api/admin/orders` cacheable: every customer's
 * name, phone, address and order total stored at the edge, then served to the NEXT request for that
 * URL with no token at all, never reaching requireAdminSession. An authentication bypass and a
 * customer-data leak, produced by flipping a toggle in a dashboard.
 *
 * Fixing it per-route would mean every future route remembering to opt out. This way a route added
 * next year is private until somebody deliberately decides otherwise.
 */

/** Applied globally. Anything that wants to be cached has to say so afterwards. */
export function noStore(_req: Request, res: Response, next: NextFunction): void {
  res.set('Cache-Control', 'no-store');
  next();
}

/**
 * Opt one response out of the default and let a shared cache keep it.
 *
 * Only for responses that are identical for every visitor and carry nothing personal.
 *
 * `s-maxage` targets the shared cache alone and `max-age=0` keeps browsers revalidating, so purging
 * at the edge is enough to push a change out — otherwise a stale copy would sit in every visitor's
 * own browser cache until it expired, where no purge can reach it. `stale-while-revalidate` lets the
 * edge serve the old copy while fetching a new one, so an expiry never lands as a slow request on
 * whoever happens to arrive first.
 *
 * Keep the TTL well inside the lifetime of anything embedded in the response. Product and banner
 * payloads carry SIGNED image URLs, and a cached copy outliving its signatures would serve broken
 * images until it expired.
 */
export function publicCache(res: Response, seconds = 60): void {
  res.set('Cache-Control', `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 5}`);
}
