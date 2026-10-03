import type { Metadata } from 'next';
import StockAnalysisContainer from '@/components/stock-analysis-container';
export const metadata: Metadata = {title:'Explore Stocks | Zeitgeist',description:'Daily prices, technical evidence and AI perspectives in one financial workspace.'};
export default async function StockAnalysisPage({ searchParams }: { searchParams: Promise<{ ticker?: string }> }) {
  const { ticker } = await searchParams;
  const symbol = typeof ticker === 'string' && /^[A-Z]{1,5}$/i.test(ticker) ? ticker.toUpperCase() : undefined;
  return <StockAnalysisContainer defaultTicker={symbol}/>;
}
