"use client";
import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';

export function AnalysisProgress() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return <div className="my-8 text-sm text-muted-foreground"><p role="status" className="flex items-start gap-3"><LoaderCircle size={20} className="mt-0.5 shrink-0 animate-spin text-blue-300"/>{elapsed < 20 ? 'Prices are ready. AI is preparing its analysis.' : 'AI is taking longer to respond. Your price data is available below.'}</p><p className="mt-4 pl-8 text-xs" aria-hidden="true">{elapsed}s elapsed · 60s maximum wait</p><p className="mt-3 pl-8 text-xs leading-6">New analyses need a model response. Matching saved results are reused automatically.</p></div>;
}
