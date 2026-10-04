"use client";

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { completeEmailFragment } from '@/lib/auth-link';

export default function EmailLinkCompletion() {
  const completion = useRef<Promise<string> | null>(null);
  useEffect(() => {
    let active = true;
    if (!completion.current) {
      const url = new URL(window.location.href), hash = url.hash;
      // Remove credentials before Supabase initialization, rendering links or navigating.
      url.hash = '';
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
      completion.current = completeEmailFragment(hash, url.searchParams.get('next') ?? '/stock-analysis', createClient);
    }
    void completion.current.then(path => { if (active) window.location.replace(path); });
    return () => { active = false; };
  }, []);
  return <main className="terminal-shell flex min-h-dvh items-center justify-center p-6"><section className="app-panel max-w-md p-8 text-center"><h1 className="text-2xl font-semibold">Verifying your email link</h1><p role="status" className="mt-4 text-sm text-muted-foreground">Finishing secure account access…</p></section></main>;
}
