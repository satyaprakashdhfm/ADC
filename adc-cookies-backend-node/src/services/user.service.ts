import { getOne } from '../db/index.js';
import { ApiError } from '../utils/ApiError.js';

/*
 * The signed-in user's row, by the email on their session.
 *
 * This was defined three times, character for character, in the address, cart and order routes.
 * Harmless while it stayed identical; the risk was the day one of them started tolerating a
 * missing user and the other two kept throwing, which is the sort of difference nobody notices
 * until an account behaves differently depending on which page they opened.
 *
 * Throwing on a missing row is deliberate. parseAuth has already established WHO the caller is, so
 * by this point no row means the session outlived the account, and continuing with `undefined`
 * would write orphaned rows against user_id = undefined.
 */
export async function userByEmail(email) {
  const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);
  if (!user) throw new ApiError('User not found');
  return user;
}
