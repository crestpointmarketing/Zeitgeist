import type { NewsEvidence } from '@/lib/news-evidence';
import { safeNewsUrl } from '@/lib/news-url';
import type { StockAnalysis } from '@/types/stock';
import { ExternalLink, Newspaper } from 'lucide-react';

const statusCopy = {
  empty: 'No usable recent coverage was returned for this symbol. This does not mean no news exists.',
  unavailable: 'News is temporarily unavailable. Price history and technical analysis remain available.',
  not_configured: 'The news service is not configured. Price history remains available.',
};

export function StockNews({ news, analysis, sessionTimestamp }: {
  news?: NewsEvidence; analysis?: StockAnalysis | null; sessionTimestamp: number;
}) {
  const date = (value: string) => new Date(value).toLocaleString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) + ' ET';
  return <section className="space-y-5 p-5 sm:p-7" aria-label="News and sources">
    <header><p className="app-eyebrow flex items-center gap-2"><Newspaper size={15}/>Related coverage</p>
      <h2 className="mt-2 text-xl font-semibold">News &amp; sources</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Headlines and provider excerpts, not independently verified facts. Some articles mention the company as part of broader coverage.</p>
    </header>
    {!news || news.status !== 'ready' ? <p role="status" className="rounded-xl border border-border bg-background p-5 text-sm text-muted-foreground">
      {news ? statusCopy[news.status as keyof typeof statusCopy] : 'Refresh prices to load news for this snapshot.'}
    </p> : <>
      <p className="text-xs text-muted-foreground">Via {news.source} · Past {news.window_days} days · Retrieved {date(news.fetched_at)}</p>
      {!!analysis?.news_analysis?.length && <section aria-label="AI reading of the news" className="rounded-xl border border-blue-400/25 bg-blue-500/5 p-4">
        <h3 className="text-sm font-semibold text-blue-200">AI reading of the news</h3>
        <p className="mt-1 text-xs text-muted-foreground">Interpretation from the excerpts below; verify the original reporting.</p>
        <ul className="mt-3 space-y-3">{analysis.news_analysis.map((item, index) => <li key={index} className="text-sm leading-relaxed">
          <p>{item.summary}</p><div className="mt-1 flex gap-3">{[...new Set(item.source_ids)].map(id => news.articles.some(article => article.id === id)
            ? <a key={id} href={`#news-${id}`} className="text-primary underline underline-offset-4">[{id}]</a> : null)}</div>
        </li>)}</ul>
      </section>}
      <ol className="space-y-3">{news.articles.map(article => {
        const url = safeNewsUrl(article.url);
        return <li key={article.id} id={`news-${article.id}`} className="scroll-mt-32 rounded-xl border border-border bg-background/50 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"><span className="font-mono text-primary">[{article.id}]</span><span>{article.publisher}</span><time dateTime={article.published_at}>{date(article.published_at)}</time></div>
          <h3 className="mt-3 text-base font-medium leading-relaxed">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{article.title}<ExternalLink size={13} className="ml-2 inline" aria-label="Opens original article in a new tab"/></a> : article.title}</h3>
          {article.description && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{article.description}</p>}
          {Date.parse(article.published_at) > sessionTimestamp && <p className="mt-3 text-xs text-amber-200">Published after the latest price session</p>}
        </li>;
      })}</ol>
    </>}
  </section>;
}
