import { HttpResponse } from 'msw';
import { apiError } from './mock-http';

type Outcome = Response | { response: Response; replay: () => Response };

interface StoredResult {
  fingerprint: string;
  replay: () => Response;
}

const results = new Map<string, StoredResult>();

function snapshot(response: Response, body: string): () => Response {
  const headers = new Headers(response.headers);
  return () => new HttpResponse(body, { status: response.status, headers });
}

/**
 * Applies CF §2.3 to a mock write handler:
 * missing key → 400; same key + same body → stored result with `Idempotent-Replayed: true`
 * (async commands replay their current state); same key + different body → 422.
 */
export async function idempotent(
  request: Request,
  run: (body: unknown) => Outcome | Promise<Outcome>,
): Promise<Response> {
  const key = request.headers.get('Idempotency-Key');
  if (!key) return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED');

  const raw = await request.text();
  const fingerprint = `${request.method} ${new URL(request.url).pathname} ${raw}`;
  const stored = results.get(key);
  if (stored) {
    if (stored.fingerprint !== fingerprint) return apiError(422, 'IDEMPOTENCY_KEY_REUSED');
    const replayed = stored.replay();
    replayed.headers.set('Idempotent-Replayed', 'true');
    return replayed;
  }

  let body: unknown;
  try {
    body = raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return apiError(400, 'BAD_REQUEST');
  }

  const outcome = await run(body);
  const response = outcome instanceof Response ? outcome : outcome.response;
  if (response.ok) {
    const replay =
      outcome instanceof Response ? snapshot(response, await response.clone().text()) : outcome.replay;
    results.set(key, { fingerprint, replay });
  }
  return response;
}

export function resetMockIdempotency(): void {
  results.clear();
}
