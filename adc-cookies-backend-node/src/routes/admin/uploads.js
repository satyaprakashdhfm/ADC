import { Router, raw } from 'express';
import { ApiError } from '../../middleware.js';
import {
  uploadMedia, deleteMedia, signMediaRef, storageConfigured,
  ALLOWED_TYPES, MAX_UPLOAD_BYTES, isMediaRef,
} from '../../storage.js';

const router = Router();

/*
 * Image upload for the admin dashboard. Mounted under /api/admin, so it is already behind
 * requireAdminSession — nothing here checks authorisation itself, and nothing here should.
 *
 * The body is the file's raw bytes, not multipart. That avoids a form-parsing dependency for a
 * single-file upload, and the browser side is one line: send the File as the body with its own
 * content type. express.json() above ignores it (it only claims application/json), so the stream is
 * still intact by the time this parser sees it.
 *
 * Which folder a file lands in is chosen HERE, from a fixed list — not taken from the request. A
 * caller-supplied path is a way to write anywhere in the bucket, including over somebody else's
 * object.
 */

const PREFIXES = {
  product: 'products',
  hero: 'hero',
};

const rawImage = raw({ type: Object.keys(ALLOWED_TYPES), limit: MAX_UPLOAD_BYTES });

router.post('/uploads', rawImage, async (req, res) => {
  if (!storageConfigured()) {
    throw new ApiError('Image storage is not configured on this environment (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).', 503);
  }
  const prefix = PREFIXES[String(req.query.kind || '').toLowerCase()];
  if (!prefix) throw new ApiError(`Unknown upload kind. Use one of: ${Object.keys(PREFIXES).join(', ')}.`);

  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES[contentType]) {
    throw new ApiError(`${contentType || 'That file type'} cannot be uploaded. Use JPG, PNG, WebP, AVIF or GIF.`);
  }
  // Not a Buffer means the parser above declined it — almost always a mismatched content type.
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw new ApiError('No file was received. Send the image bytes as the request body.');
  }

  try {
    const saved = await uploadMedia({
      buffer: req.body,
      contentType,
      prefix,
      name: String(req.query.name || 'image'),
    });
    // The signed URL comes back with it so the form can show a preview at once, without a second
    // round trip. Only `ref` is ever stored.
    res.json({ ...saved, url: await signMediaRef(saved.ref) });
  } catch (err) {
    throw new ApiError(err?.message || 'Upload failed', 502);
  }
});

/*
 * Delete an uploaded object.
 *
 * Only ever for a reference nothing points at any more — the caller is responsible for having
 * removed it from the row first, because an object deleted while a product still names it leaves a
 * broken image rather than no image. Refuses anything that is not a supabase:// reference, so this
 * cannot be pointed at a file under /assets.
 */
router.delete('/uploads', async (req, res) => {
  const ref = String(req.body?.ref || '').trim();
  if (!isMediaRef(ref)) throw new ApiError('That is not an uploaded file, so there is nothing to delete.');
  res.json({ ok: await deleteMedia(ref) });
});

export default router;
