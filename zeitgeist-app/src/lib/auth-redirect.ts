/** Return only normalized local paths. Never trust a login query parameter as a URL. */
export function safeRedirectPath(value: string | null | undefined, fallback = '/cfo'): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u0020]/.test(decoded)) return fallback;
    const url = new URL(value, 'https://local.invalid');
    return url.origin === 'https://local.invalid' && !url.pathname.startsWith('//')
      ? url.pathname + url.search + url.hash : fallback;
  } catch { return fallback; }
}
