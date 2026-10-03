import { safeNewsUrl } from './news-url';
import { z } from 'zod';

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  publisher: string;
  published_at: string;
  description: string;
}
export interface NewsEvidence {
  status: 'ready' | 'empty' | 'unavailable' | 'not_configured';
  source: string;
  fetched_at: string;
  window_days: number;
  articles: NewsArticle[];
}

export const NEWS_WINDOW_DAYS = 7;
export function unavailableNews(status: NewsEvidence['status'] = 'unavailable', now = Date.now()): NewsEvidence {
  return { status, source: 'Polygon.io news', fetched_at: new Date(now).toISOString(), window_days: NEWS_WINDOW_DAYS, articles: [] };
}

export { safeNewsUrl } from './news-url';

const rawArticle = z.object({
  title: z.string().min(1).max(2000), article_url: z.string().max(4096),
  published_utc: z.string().datetime({ offset: true }),
  publisher: z.object({ name: z.string().min(1).max(500) }),
  tickers: z.array(z.string()).max(100), description: z.string().max(20000).optional(),
});
const clean = (text: string, max: number) => text.replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export function normalizeNewsPayload(payload: unknown, ticker: string, now = Date.now()): NewsEvidence {
  const envelope = z.object({ results: z.array(z.unknown()).max(100) }).parse(payload);
  const articles: NewsArticle[] = [];
  const seen = new Set<string>();
  for (const raw of envelope.results) {
    const parsed = rawArticle.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const published = Date.parse(item.published_utc);
    const url = safeNewsUrl(item.article_url);
    const title = clean(item.title, 250);
    if (!url || !title || !item.tickers.includes(ticker) || published > now
      || published < now - NEWS_WINDOW_DAYS * 86400000 || seen.has(url)) continue;
    seen.add(url);
    articles.push({ id: '', title, url, publisher: clean(item.publisher.name, 100),
      published_at: new Date(published).toISOString(), description: clean(item.description ?? '', 500) });
  }
  articles.sort((a, b) => b.published_at.localeCompare(a.published_at) || a.url.localeCompare(b.url));
  const selected = articles.slice(0, 5).map((article, index) => ({ ...article, id: `N${index + 1}` }));
  return { ...unavailableNews(selected.length ? 'ready' : 'empty', now), articles: selected };
}
