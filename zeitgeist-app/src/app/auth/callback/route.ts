import { safeRedirectPath } from '@/lib/auth-redirect';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authLinkErrorCode, authLinkFailure } from '@/lib/auth-link';

/**
 * Handles Supabase auth redirects (email confirmation links, OAuth).
 * Exchanges the code for a session cookie, then forwards to `next`.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'));

  const redirect = (path: string) => {
    const response = NextResponse.redirect(new URL(path, requestUrl.origin));
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  };
  if (requestUrl.searchParams.has('error')) return redirect(authLinkFailure(next, authLinkErrorCode({ code: requestUrl.searchParams.get('error_code') ?? undefined })));
  // Fragments never reach this handler. The browser completes legacy email links.
  // A Location without a fragment preserves the original fragment across redirect.
  if (!code) return redirect(`/auth/complete?next=${encodeURIComponent(next)}`);
  try {
    const supabase = await createClient();
    if (!supabase) return redirect(authLinkFailure(next, 'auth_unavailable'));
    const flowId = requestUrl.searchParams.get('sb_flow_id');
    const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
    if (error) return redirect(authLinkFailure(next, authLinkErrorCode(error)));
    if (!data.session) return redirect(authLinkFailure(next));
    return redirect('redirectType' in data && data.redirectType === 'recovery' ? '/reset-password' : next);
  } catch {
    return redirect(authLinkFailure(next, 'auth_unavailable'));
  }
}
