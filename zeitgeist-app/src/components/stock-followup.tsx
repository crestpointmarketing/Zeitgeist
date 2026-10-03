"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ArrowUp, Square } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { boundedMessages } from '@/lib/chat-input';
import { stockQuestionText } from '@/lib/research-brief';
import { uiMessageText } from '@/types/cfo';
import type { StockAnalysis } from '@/types/stock';
import type { MarketResult } from '@/lib/stock-flow';

export default function StockFollowup({market,analysis}:{market:MarketResult;analysis:StockAnalysis|null}) {
  const [conversationId]=useState(()=>crypto.randomUUID());
  const [question,setQuestion]=useState('');
  const transport=useMemo(()=>new DefaultChatTransport({api:'/api/cfo/chat',body:{conversationId},prepareSendMessagesRequest:({messages,body})=>({body:{...body,messages:boundedMessages(messages)}})}),[conversationId]);
  const {messages,sendMessage,status,error,stop,regenerate,clearError}=useChat({id:conversationId,transport});
  const busy=status==='submitted'||status==='streaming';
  const ask=(text:string)=>{if(!text.trim()||busy)return;clearError();void sendMessage({text:stockQuestionText(text,market,analysis)});setQuestion('');};
  const reply=messages.at(-1)?.role==='assistant'?messages.at(-1):undefined;
  const asked=messages.filter(m=>m.role==='user').at(-1);
  return <div className="mt-6 border-t border-border pt-5">
    <div className="flex flex-wrap gap-2">{['Why did it move?','Explain the risk'].map(text=><button type="button" disabled={busy} key={text} onClick={()=>ask(text)} className="min-h-10 rounded-lg border border-border px-3 text-xs text-blue-200 hover:bg-blue-400/5 disabled:opacity-50">{text}</button>)}</div>
    <form className="mt-3 flex items-end gap-2 rounded-lg border border-input bg-background p-2" onSubmit={event=>{event.preventDefault();ask(question);}}><textarea rows={2} maxLength={800} aria-label={`Ask about ${market.stock_data.ticker}`} placeholder={`Ask about ${market.stock_data.ticker}…`} value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();ask(question);}}} className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"/>{busy?<button type="button" className="app-icon-button" aria-label="Stop response" onClick={()=>void stop()}><Square size={17}/></button>:<button type="submit" disabled={!question.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white disabled:bg-slate-700 disabled:text-slate-400" aria-label="Send stock question"><ArrowUp size={18}/></button>}</form>
    {busy&&<p role="status" className="mt-3 text-xs text-cyan-200">{status==='submitted'?'Preparing an answer…':'Answering…'}</p>}
    {error&&<p role="alert" className="mt-3 text-xs text-rose-300">The answer could not be completed. <button className="underline" onClick={()=>{clearError();void regenerate();}}>Retry</button></p>}
    {asked&&<p className="mt-4 text-xs leading-6 text-muted-foreground">{uiMessageText(asked).split("\n\nResearch snapshot")[0]}</p>}{reply&&<div className="prose prose-invert prose-sm mt-4 max-h-80 overflow-auto text-sm" aria-label="Answer to stock question"><ReactMarkdown>{uiMessageText(reply)}</ReactMarkdown></div>}
    {messages.length>0&&<Link className="mt-3 inline-flex min-h-10 items-center text-xs text-blue-200 underline" href={`/cfo?c=${conversationId}`}>Open conversation in AI CFO</Link>}
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Uses this stock’s displayed snapshot. AI can make mistakes.</p>
  </div>;
}
