import { safeRedirectPath } from '@/lib/auth-redirect';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Handles Supabase auth redirects (email confirmation links, OAuth).
 * Exchanges the code for a session cookie, then forwards to `next`.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = safeRedirectPath(requestUrl.searchParams.get('next'));

  if (!code) return NextResponse.redirect(new URL('/login?error=auth_callback', requestUrl.origin));
  if (code) {
    const supabase = await createClient();
    if (!supabase) return NextResponse.redirect(new URL('/login?error=auth_callback', requestUrl.origin));
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return NextResponse.redirect(new URL('/login?error=auth_callback', requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
