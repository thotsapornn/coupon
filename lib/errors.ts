export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'DRIVE_UPLOAD_FAILED'
  | 'SHEET_WRITE_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status = 400,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

export function notFound(message = 'ไม่พบคูปองนี้') {
  return new ApiError('NOT_FOUND', message, 404);
}

export function invalidState(message: string) {
  return new ApiError('INVALID_STATE', message, 409);
}

export function validationError(message: string, fields?: Record<string, string>) {
  return new ApiError('VALIDATION_ERROR', message, 400, fields);
}
