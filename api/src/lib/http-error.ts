export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(msg = 'Bad request', details?: unknown) {
    return new HttpError(400, msg, 'BAD_REQUEST', details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new HttpError(401, msg, 'UNAUTHORIZED');
  }
  static forbidden(msg = 'Forbidden') {
    return new HttpError(403, msg, 'FORBIDDEN');
  }
  static notFound(msg = 'Not found') {
    return new HttpError(404, msg, 'NOT_FOUND');
  }
  static conflict(msg = 'Conflict', code = 'CONFLICT', details?: unknown) {
    return new HttpError(409, msg, code, details);
  }
  static unavailable(msg = 'Service unavailable') {
    return new HttpError(503, msg, 'UNAVAILABLE');
  }
}
