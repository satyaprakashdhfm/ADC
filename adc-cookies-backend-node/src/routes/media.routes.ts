import { Router } from 'express';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { resolveMediaPath, verifyMediaSignature, TYPE_BY_EXT } from '../services/storage.client.js';

/*
 * Serving uploaded media.
 *
 * Supabase Storage used to do this: it held the bytes and minted signed URLs to its own CDN. The
 * files are on our disk now (see storage.client.ts), so this is what stands in for that CDN.
 *
 * THE SIGNATURE IS THE AUTHORISATION. There is no session check here, deliberately — product
 * photos are shown to anonymous shoppers browsing the catalogue, so requiring a login would break
 * the storefront. What the signature buys is that the files are not enumerable: knowing the
 * directory layout gets you nothing without a signature we minted, and every signature expires.
 *
 * Two protections, and neither is redundant. The HMAC proves we issued this exact path with this
 * exact expiry. resolveMediaPath proves the resolved file is inside the media directory whatever
 * the path claims — belt and braces, because a signature only certifies that a path came from us,
 * and the day something upstream signs a path it should not, this is the check that still holds.
 */

const router = Router();

/*
 * A week, matching the signature's own lifetime, and immutable because the filename carries a
 * timestamp: the bytes behind a given path never change, so a browser that has one need never ask
 * again. This is most of the point of serving media through our own process rather than none —
 * without it every page view would re-download every photo from Railway.
 */
const CACHE_CONTROL = 'private, max-age=604800, immutable';

/* '/*' and params[0], not Express 5's '/*splat' — this app is on Express 4.21, where the named
   form matches nothing at all and every image would 404 with no error to explain it. */
router.get('/*', async (req, res) => {
  /* Everything after /api/media. Decoded per segment because signMediaRefs encodes them that way,
     and because a raw %2e%2e must become '..' HERE so resolveMediaPath can reject it — leaving it
     encoded would smuggle it past a containment check that never saw it. */
  const raw = String((req.params as any)[0] || '');
  let rel: string;
  try {
    rel = raw.split('/').map(decodeURIComponent).join('/');
  } catch {
    return res.status(400).json({ error: 'Bad request', message: 'Malformed media path.' });
  }

  if (!verifyMediaSignature(rel, req.query?.exp, req.query?.sig)) {
    /* One answer for a bad signature, an expired one, and a file that is not there. Distinguishing
       them would confirm which paths exist to somebody guessing, and there is nothing a legitimate
       caller can do differently with the detail. */
    return res.status(404).json({ error: 'Not found', message: 'This link is not valid or has expired.' });
  }

  const full = resolveMediaPath(rel);
  if (!full) return res.status(404).json({ error: 'Not found', message: 'This link is not valid or has expired.' });

  let stat: import('node:fs').Stats;
  try {
    stat = await fsp.stat(full);
    if (!stat.isFile()) throw new Error('not a file');
  } catch {
    return res.status(404).json({ error: 'Not found', message: 'This link is not valid or has expired.' });
  }

  const ext = path.extname(full).slice(1).toLowerCase();
  res.setHeader('Content-Type', TYPE_BY_EXT[ext] || 'application/octet-stream');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Cache-Control', CACHE_CONTROL);
  /* The allowlist above means only images are ever served, but nosniff costs nothing and removes
     the class of bug where a future content type is guessed into something executable. */
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(full);
  /* A client that navigates away mid-image aborts the response; without this the stream stays open
     holding a file descriptor, and enough of them exhaust the process. */
  res.on('close', () => stream.destroy());
  stream.on('error', () => { if (!res.headersSent) res.status(500).end(); else res.destroy(); });
  stream.pipe(res);
});

export default router;
