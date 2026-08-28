/*
 * POST /api/chat — the support assistant.
 *
 * Deliberately NOT behind requireAuth: a visitor who has not signed in can still ask what we sell
 * and where we deliver. What changes with sign-in is the TOOL SET, not access to the endpoint —
 * see chat.service.buildAgent. parseAuth has already run app-wide, so req.user is present when a
 * valid token was sent and absent otherwise, and that is the only thing deciding what the assistant
 * can reach.
 *
 * The API key never leaves this process. The browser talks to us; we talk to Google.
 */
import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { pipeAgentUIStreamToResponse } from 'ai';
import { buildAnonymousAgent, buildCustomerAgent, chatConfigured, CHAT_MODEL_ID } from '../services/chat.service.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

/*
 * Tight on purpose: every message costs a model call, and an unattended loop pointed at this
 * endpoint is somebody else's bill. Keyed per signed-in user where we have one, per IP otherwise,
 * so one abusive visitor cannot spend everybody's allowance.
 */
const chatLimiter = rateLimit({
  windowMs: 5 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  /* ipKeyGenerator, not req.ip: a raw IP key lets an IPv6 client hop addresses within its own /64
     and get a fresh allowance each time, which the library refuses to start without. */
  keyGenerator: (req: any, res: any) => (req.user?.id ? `u${req.user.id}` : ipKeyGenerator(req, res)),
  message: { error: 'Too many messages', message: 'You are sending messages very quickly — give it a moment.' },
});

/** Longest conversation we will carry. Beyond this the thread is the problem, not the answer. */
const MAX_TURNS = 40;

router.post('/', chatLimiter, async (req, res) => {
  if (!chatConfigured()) throw new ApiError('Chat is not configured on this environment.', 503);

  const messages = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!messages || !messages.length) throw new ApiError('No messages sent.');
  if (messages.length > MAX_TURNS) throw new ApiError('This conversation is very long — please start a new one.');

  const userId = req.user?.id ?? null;
  console.log(`[CHAT] ${userId ? `user=${userId}` : 'anonymous'} | turns=${messages.length} | model=${CHAT_MODEL_ID}`);

  /* Errors reach the customer as a sentence, not a stack. A model or quota failure is ours to see
     in the logs, not theirs to read. */
  const onError = (error: any) => {
    console.error(`[CHAT] ✗ ${error?.message || error}`);
    return 'Sorry — I had trouble just then. Could you try that again?';
  };

  /* Streams straight into the Node response — the AI SDK's own Express path, so no adapter of ours
     sits between the model and the client waiting to be got wrong.
     Branched rather than passed a nullable id: the two agents have different tool sets, and that
     difference is the thing keeping a signed-out visitor away from account data. */
  await (userId == null
    ? pipeAgentUIStreamToResponse({ response: res, agent: buildAnonymousAgent(), uiMessages: messages, onError })
    : pipeAgentUIStreamToResponse({ response: res, agent: buildCustomerAgent(userId, req.user?.name ?? null), uiMessages: messages, onError }));
});

export default router;
