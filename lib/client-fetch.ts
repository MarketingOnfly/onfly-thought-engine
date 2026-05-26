/**
 * Wrapper sobre fetch que sempre devolve um payload JSON estruturado,
 * mesmo quando o servidor responde com HTML/500/timeout.
 * Resolve o famoso "Unexpected end of JSON input".
 */

interface ApiOk<T> {
  ok: true;
  status: number;
  data: T;
}

interface ApiErr {
  ok: false;
  status: number;
  error: string;
}

export type ApiResult<T> = ApiOk<T> | ApiErr;

export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(input, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error:
        err instanceof Error
          ? `Falha de rede: ${err.message}`
          : "Falha de rede.",
    };
  }

  const raw = await res.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const msg =
      (parsed as { error?: string } | null)?.error ??
      (raw && raw.length < 240 ? raw : `HTTP ${res.status}`);
    return { ok: false, status: res.status, error: msg };
  }

  return { ok: true, status: res.status, data: (parsed ?? {}) as T };
}
