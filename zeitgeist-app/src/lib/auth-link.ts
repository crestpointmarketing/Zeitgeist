import { safeRedirectPath } from './auth-redirect';

type LinkError = { code?: string; name?: string; status?: number } | null;

export function authLinkErrorCode(error: LinkError): string {
  if (error?.status && error.status >= 500) return 'auth_unavailable';
  if (error?.code === 'otp_expired' || error?.code === 'flow_state_expired') return 'email_expired';
  if (error?.name === 'AuthPKCECodeVerifierMissingError' || ['pkce_code_verifier_not_found', 'bad_code_verifier', 'flow_state_not_found'].includes(error?.code ?? '')) return 'email_browser';
  return 'auth_callback';
}

export function authLinkFailure(next: string, issue = 'auth_callback'): string {
  const query = new URLSearchParams({ error: issue, next: safeRedirectPath(next, '/stock-analysis') });
  return `/login?${query}`;
}

export function authLinkNotice(issue: string | null): string | null {
  if (issue === 'auth_unavailable') return 'We could not finish verifying your email link because the account service was unavailable. Please try again.';
  if (issue === 'email_browser') return 'Open the email link in the browser where you requested it, or request a new link here. You can also sign in below with your email and password.';
  if (issue === 'email_expired') return 'That email link has expired or has already been used. You can still sign in below with your email and password, or request a new link.';
  if (issue === 'auth_callback') return 'We could not verify that email link. You can still sign in below with your email and password, or request a new link.';
  return null;
}

type SessionClient = { auth: {
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<{ error: LinkError }>;
  getUser(): Promise<{ data: { user: { id: string } | null }; error: LinkError }>;
} };

/** Legacy Supabase emails return session tokens in a fragment, invisible to the server.
 * The caller must remove the fragment before initializing the browser client.
 * Existing sessions alone never count as successful email-link verification. */
export async function completeEmailFragment(hash: string, next: string, getClient: () => SessionClient | null): Promise<string> {
  const target = safeRedirectPath(next, '/stock-analysis');
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.has('error') || params.has('error_code')) return authLinkFailure(target, authLinkErrorCode({ code: params.get('error_code') ?? undefined }));
  const access_token = params.get('access_token'), refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return authLinkFailure(target);
  try {
    const client = getClient();
    if (!client) return authLinkFailure(target, 'auth_unavailable');
    const { error } = await client.auth.setSession({ access_token, refresh_token });
    if (error) return authLinkFailure(target, authLinkErrorCode(error));
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) return authLinkFailure(target, authLinkErrorCode(verified.error));
    return params.get('type') === 'recovery' ? '/reset-password' : target;
  } catch {
    return authLinkFailure(target, 'auth_unavailable');
  }
}
