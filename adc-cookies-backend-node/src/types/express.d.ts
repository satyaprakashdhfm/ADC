/*
 * What our middleware hangs on the request.
 *
 * Express's Request carries no notion of who is asking, so parseAuth, requireStoreUser and
 * requireAdminSession each attach their own object to it. In JavaScript that was invisible; in
 * TypeScript it has to be declared once, here, or every route that reads req.user is an error.
 *
 * All three are OPTIONAL on purpose, and that is the useful part. parseAuth runs on every request
 * and attaches req.user only when a token verified, so `req.user` really can be undefined — which
 * is exactly the bug this catches. A route that reads req.user.id without going through
 * requireAuth first is now a compile error rather than a 500 on an anonymous request.
 *
 * The three are separate identities, not roles of one: a customer session (Supabase token), a store
 * tablet login (our own HS256 token) and an admin session (allowlisted phone + OTP). Nothing
 * upgrades one into another, which is why requireAdminSession is the admin gate and users.role is
 * not.
 */
import 'express';

declare global {
  namespace Express {
    /** The signed-in customer, from parseAuth. Present only when a Supabase token verified. */
    interface AuthUser {
      id: number;
      email: string | null;
      name: string | null;
      role: string | null;
      phone: string | null;
    }

    /** A store tablet, from requireStoreUser. */
    interface StoreUser {
      id: number;
      storeCode: string;
      username: string;
      name: string | null;
      store: any;
    }

    /** An admin session, from requireAdminSession. Keyed on an allowlisted phone, not a user row. */
    interface AdminSession {
      phone: string;
      name: string | null;
      expiresAt: string | null;
    }

    interface Request {
      user?: AuthUser;
      storeUser?: StoreUser;
      admin?: AdminSession;
    }
  }
}
