import { upstreamError } from "../errors/http-error.js";

export function assertSupabaseOk(error: { message?: string; code?: string } | null, action: string): void {
  if (!error) return;
  throw upstreamError(`Falha ao ${action}.`, {
    code: error.code,
    message: error.message,
  });
}
