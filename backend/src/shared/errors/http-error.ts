export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = "HTTP_ERROR", details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): HttpError {
  return new HttpError(400, message, "BAD_REQUEST", details);
}

export function unauthorized(message = "Autenticacao obrigatoria."): HttpError {
  return new HttpError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "Acesso negado."): HttpError {
  return new HttpError(403, message, "FORBIDDEN");
}

export function notFound(message = "Registro nao encontrado."): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}

export function conflict(message: string, details?: unknown): HttpError {
  return new HttpError(409, message, "CONFLICT", details);
}

export function gone(message: string): HttpError {
  return new HttpError(410, message, "GONE");
}

export function upstreamError(message: string, details?: unknown): HttpError {
  return new HttpError(502, message, "UPSTREAM_ERROR", details);
}
