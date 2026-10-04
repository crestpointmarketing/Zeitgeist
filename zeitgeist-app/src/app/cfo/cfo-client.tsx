"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, ShieldCheck, ChartNoAxesCombined, ArrowUpRight } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { ChatThread } from "@/components/cfo/chat-thread";
import { ConversationSidebar } from "@/components/cfo/conversation-sidebar";
import { useConversationMessages } from "@/components/cfo/use-conversation-messages";

import { createClient } from '@/lib/supabase/client';
import { lastConversation, rememberConversation, validConversationId } from '@/lib/conversation-handoff';

export default function CfoPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [accountId, setAccountId] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const requestedId = searchParams.get('c');
  const contextJobId=searchParams.get('context');
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      setActiveId(null); setAuthError(false);
      try {
        const client = createClient();
        const result = await client?.auth.getUser();
        if (cancelled) return;
        if (!result?.data.user || result.error) { router.replace('/login?next=%2Fcfo'); return; }
        const userId = result.data.user.id;
        setAccountId(userId);
        setActiveId(validConversationId(requestedId) ? requestedId : (!contextJobId&&lastConversation(userId)) || crypto.randomUUID());
      } catch { if (!cancelled) setAuthError(true); }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [requestedId, router, contextJobId]);
  useEffect(() => { if (accountId && activeId) rememberConversation(accountId, activeId); }, [accountId, activeId]);

  const selectConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      router.replace(`/cfo?c=${id}`);
    },
    [router]
  );

  const newConversation = useCallback(() => {
    selectConversation(crypto.randomUUID());
  }, [selectConversation]);

  const { messages, error: loadError, retry: retryLoad } = useConversationMessages(activeId);

  return <WorkspaceShell sidebarContent={<ConversationSidebar embedded activeId={activeId} refreshKey={refreshKey} onSelect={selectConversation} onNew={newConversation} onDeleted={id=>{if(id===activeId)newConversation();setRefreshKey(k=>k+1);}}/>}>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="app-panel flex h-[calc(100dvh-12rem)] min-h-[360px] sm:min-h-[440px] min-w-0 flex-col overflow-hidden" aria-label="AI CFO conversation">
        <header className="flex items-center gap-3 border-b border-border px-5 py-5"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/15 text-primary"><Sparkles size={22}/></span><div><h1 className="text-lg font-semibold">Your AI CFO</h1><p className="mt-1 text-xs text-muted-foreground">A clearer perspective on your financial questions</p></div></header>
        {authError ? <div role="alert" className="p-6">Could not verify your session.<button className="app-button-secondary mt-4" onClick={() => window.location.reload()}>Try again</button></div> : loadError ? <div role="alert" className="p-6 text-sm text-destructive">{loadError}<button className="app-button-secondary mt-4" onClick={retryLoad}>Retry loading messages</button></div> : activeId && messages!==null ? <ChatThread key={activeId} conversationId={activeId} contextJobId={validConversationId(contextJobId)?contextJobId:undefined} initialMessages={messages} onAssistantFinish={()=>setRefreshKey(k=>k+1)}/> : <div role="status" className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading your conversation…</div>}
      </section>
      <aside className="insight-panel hidden flex-col p-6 xl:flex"><div className="flex items-center gap-3"><Sparkles size={28} className="text-blue-400"/><h2 className="text-xl font-semibold">A little perspective</h2></div><h3 className="mt-7 text-xl font-semibold leading-relaxed">Better questions.<br/>More informed decisions.</h3><p className="mt-4 text-sm leading-7 text-muted-foreground">Use this space to unpack a financial concept, think through a budget, or examine an assumption.</p><div className="my-7 rounded-xl border border-border bg-primary/5 p-5"><p className="text-xs text-muted-foreground">Make your question specific</p><p className="mt-3 text-lg font-medium text-cyan-300">Share a goal, a time frame and the tradeoffs.</p></div><div className="space-y-5 text-sm leading-relaxed text-muted-foreground"><p className="flex items-start gap-3"><ShieldCheck size={21} className="shrink-0 text-primary"/>Treat answers as a starting point. Check facts and consider your circumstances.</p><p className="flex items-start gap-3"><ChartNoAxesCombined size={21} className="shrink-0 text-primary"/>For a stock’s daily prices and indicators, open the research workspace.</p></div><Link href="/research" className="app-button-secondary mt-4">Prepare a stock comparison</Link><Link href="/stock-analysis" className="app-button mt-auto w-full justify-between">Explore a stock<ArrowUpRight size={18}/></Link></aside>
    </div>
  </WorkspaceShell>;
}
