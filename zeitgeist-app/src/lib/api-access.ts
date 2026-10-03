import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export class RequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

/** Enforce the limit while reading, including chunked requests without Content-Length. */
export async function readJson(request: Request, maxBytes = 65_536): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) {
    throw new RequestError('Request is too large.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError('A JSON body is required.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError('Request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new RequestError('Invalid JSON body.', 400); }
}

export async function requireAccount() {
  const supabase = await createClient();
  if (!supabase) throw new RequestError('Accounts are not configured yet.', 503);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new RequestError('Sign in to use this feature.', 401);
  return { supabase, user };
}

export async function reserveUsage(
  supabase: Awaited<ReturnType<typeof requireAccount>>['supabase'],
  feature: 'analysis' | 'chat' | 'stock',
) {
  const { data, error } = await supabase.rpc('reserve_api_usage', { feature });
  // Missing migration / database outage must never bypass the budget.
  if (error || !data) throw new RequestError('Usage controls are unavailable. Please try later.', 503);
  if (!data.allowed) throw new RequestError('Request limit reached. Please try later.', 429);
  return async () => {
    const { error: releaseError } = await supabase.rpc('release_api_usage', { lease_id: data.lease_id });
    if (releaseError) console.error('Failed to release usage lease', releaseError.code);
  };
}

export function requestErrorResponse(error: unknown) {
  const status = error instanceof RequestError ? error.status : 500;
  const message = error instanceof RequestError ? error.message : 'The request could not be completed.';
  return Response.json({ success: false, error: { message, status_code: status } }, {
    status, headers: { 'Cache-Control': 'no-store' },
  });
}

export async function protectedRequest(
  request: NextRequest,
  feature: 'analysis' | 'stock',
  handler: (request: NextRequest) => Promise<Response>,
) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { supabase } = await requireAccount();
    const boundedRequest = request.method === 'POST'
      ? new NextRequest(request.url, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(await readJson(request)),
        })
      : request;
    release = await reserveUsage(supabase, feature);
    const response = await handler(boundedRequest);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    return requestErrorResponse(error);
  } finally { await release?.(); }
}
