/*
 * The WhatsApp support inbox API, mounted twice:
 *
 *   /api/store/support   behind the store login, scoped to that store (routes/store.routes)
 *   /api/admin/support   behind the admin session, every conversation (routes/admin.routes)
 *
 * The scope and the name a reply is signed with come from the signed-in credential, via the two
 * functions the mount passes in, never from the request body. See services/support/inbox.service.
 */
import { Router } from 'express';
import { ApiError } from '../utils/ApiError.js';
import {
  listConversations, openConversation, staffReply, takeOver, handBack, closeConversation, inboxSummary, mediaFor,
  type InboxScope, type Staff,
} from '../services/support/inbox.service.js';

export function supportInboxRouter(scopeOf: (req: any) => InboxScope, staffOf: (req: any) => Staff) {
  const router = Router();
  const idOf = (req: any) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError('Unknown conversation.', 404);
    return id;
  };

  router.get('/summary', async (req, res) => { res.json(await inboxSummary(scopeOf(req))); });

  router.get('/conversations', async (req, res) => { res.json(await listConversations(scopeOf(req))); });

  router.get('/conversations/:id', async (req, res) => {
    const r = await openConversation(scopeOf(req), idOf(req));
    if (!r) throw new ApiError('Conversation not found.', 404);
    res.json(r);
  });

  router.post('/conversations/:id/reply', async (req, res) => {
    const text = String(req.body?.text || '').trim();
    if (!text) throw new ApiError('Type a message first.');
    if (text.length > 4000) throw new ApiError('That message is too long for WhatsApp.');
    const r = await staffReply(scopeOf(req), idOf(req), text, staffOf(req));
    if (!r.ok) throw new ApiError(r.reason === 'not_found' ? 'Conversation not found.' : `WhatsApp did not accept it: ${r.reason}`, r.reason === 'not_found' ? 404 : 502);
    res.json(r);
  });

  router.post('/conversations/:id/take', async (req, res) => {
    if (!(await takeOver(scopeOf(req), idOf(req), staffOf(req)))) throw new ApiError('Conversation not found.', 404);
    res.json({ ok: true });
  });

  router.post('/conversations/:id/release', async (req, res) => {
    if (!(await handBack(scopeOf(req), idOf(req)))) throw new ApiError('Conversation not found.', 404);
    res.json({ ok: true });
  });

  router.post('/conversations/:id/close', async (req, res) => {
    if (!(await closeConversation(scopeOf(req), idOf(req), !!req.body?.resolveTicket, staffOf(req)))) throw new ApiError('Conversation not found.', 404);
    res.json({ ok: true });
  });

  /* A customer's photo or file, streamed through us: Meta's own link needs our token. */
  router.get('/media/:mediaId', async (req, res) => {
    const r = await mediaFor(scopeOf(req), String(req.params.mediaId).slice(0, 64));
    if (!r) throw new ApiError('Not found.', 404);
    if (!r.ok) throw new ApiError('WhatsApp would not give us that file.', 502);
    res.setHeader('Content-Type', r.type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(r.bytes);
  });

  return router;
}
