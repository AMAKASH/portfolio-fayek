import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth */
      auth?: { userId: string; email: string };
      /** Set by validate({ query }) — Express 5's req.query is read-only */
      validQuery?: unknown;
    }
  }
}

export {};
