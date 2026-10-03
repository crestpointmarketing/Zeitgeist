"use client";
import { RefreshCw, MessageSquareWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
export function AnalysisUnavailable({error,ticker,onRetry,className}:{error:string;ticker:string;onRetry?:()=>void;className?:string}) {
  const dailyLimit = error.startsWith('Daily AI analysis limit reached');
  return <section role="status" className={cn('app-panel border-amber-300/30 p-5 sm:p-7',className)}><div className="flex items-start gap-3"><MessageSquareWarning className="mt-1 shrink-0 text-amber-200" size={22}/><div><h2 className="font-semibold">{dailyLimit ? 'Today’s AI analysis limit is reached.' : 'Your prices are ready. The analysis needs another try.'}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">You can keep exploring {ticker} while the AI is unavailable.</p><p className="mt-2 break-words text-sm text-muted-foreground">{error}</p>{onRetry && !dailyLimit && <button onClick={onRetry} className="app-button-secondary mt-5"><RefreshCw size={16}/>Retry analysis</button>}</div></div></section>;
}
export default AnalysisUnavailable;
