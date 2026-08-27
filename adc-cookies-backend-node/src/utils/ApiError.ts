/*
 * The error routes and services throw to produce a controlled HTTP response, rather than the 500
 * an unhandled throw would give. app.js's error handler reads .status off it; anything without one
 * is a genuine bug and stays a 500.
 *
 * It lives in utils/ and not in the auth middleware, where it sat until Phase B, because every
 * layer throws it — services and jobs included — and those have no business importing a middleware
 * to get at an error class. The dependency pointed the wrong way round.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
