/** Only public HTTPS article links may reach the browser. Links are never fetched by the model. */
export function safeNewsUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !url.hostname.includes('.') || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(':')
      || /(^|\.)(localhost|local|internal|test)$/.test(url.hostname)) return null;
    for (const key of [...url.searchParams.keys()]) if (key.startsWith('utm_') || key === 'source') url.searchParams.delete(key);
    url.hash = '';
    return url.href;
  } catch { return null; }
}
