"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';
import { Home, ChartNoAxesCombined, Sparkles, Database, ArrowUpRight, Menu, X, Search, Star } from 'lucide-react';
import { Brand } from './brand';
import { AuthControls } from './navigation';
import { cn } from '@/lib/utils';
const routes = [
  {href:'/',label:'Home',icon:Home},
  {href:'/stock-analysis',label:'Explore',icon:ChartNoAxesCombined},
  {href:'/cfo',label:'AI CFO',icon:Sparkles},
  {href:'/watchlist',label:'Watchlist',icon:Star},
];
export function WorkspaceShell({children,search,sidebarContent}:{children:ReactNode;search?:ReactNode;sidebarContent?:ReactNode}) {
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  useEffect(()=>{
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    const desktop=window.matchMedia('(min-width: 1024px)');
    const resize=()=>{if(desktop.matches)setOpen(false);};
    document.addEventListener('keydown',close); desktop.addEventListener('change',resize);
    return ()=>{document.removeEventListener('keydown',close);desktop.removeEventListener('change',resize);};
  },[]);
  return <div className="terminal-shell min-h-dvh text-foreground">
    <header className="terminal-header sticky top-0 z-40 flex min-h-24 flex-wrap items-center gap-x-6 gap-y-4 px-5 py-5 lg:px-8">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground">Skip to content</a>
      <div className="w-auto shrink-0 lg:w-44"><Brand/></div>
      <div className="order-3 w-full lg:order-none lg:min-w-0 lg:max-w-2xl lg:flex-1">{search ?? <Link href="/stock-analysis" className="terminal-search flex h-12 items-center gap-3 rounded-full border border-border px-5 text-sm text-muted-foreground"><Search size={20}/>Search a stock, e.g. AAPL, TSLA, NVDA…</Link>}</div>
      <nav className="ml-auto hidden items-center gap-7 xl:flex" aria-label="Top navigation">{routes.map(r=><Link key={r.href} href={r.href} aria-current={pathname===r.href?'page':undefined} className={cn('text-sm transition-colors hover:text-white',pathname===r.href?'text-white':'text-muted-foreground')}>{r.label}</Link>)}</nav>
      <div className="ml-auto flex items-center gap-2 xl:ml-0"><AuthControls/><button className="app-icon-button lg:hidden" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button></div>
    </header>
    <div className="flex">
      {open && <button aria-label="Close navigation" onClick={()=>setOpen(false)} className="fixed inset-0 z-20 bg-black/60 lg:hidden"/>}
      <aside className={cn('terminal-sidebar relative w-52 shrink-0 px-5 pt-4',open?'block max-lg:absolute max-lg:left-0 max-lg:z-30 max-lg:min-h-[70vh] max-lg:border-r max-lg:border-border':'hidden lg:block')} aria-label="Workspace navigation">
        <nav className="space-y-3">{routes.map(({href,label,icon:Icon})=><Link onClick={()=>setOpen(false)} key={href} href={href} aria-current={pathname===href?'page':undefined} className={cn('flex min-h-14 items-center gap-4 rounded-xl border px-4 text-sm transition-colors',pathname===href?'terminal-active border-blue-400/25 text-white':'border-transparent text-muted-foreground hover:bg-primary/5 hover:text-white')}><Icon size={21}/>{label}</Link>)}<Link href="/stock-analysis#data-evidence" onClick={()=>setOpen(false)} className="flex min-h-14 items-center gap-4 rounded-xl px-4 text-sm text-muted-foreground hover:bg-primary/5 hover:text-white"><Database size={21}/>Data sources</Link></nav>
        {sidebarContent ? <div className="mt-6 h-[calc(100dvh-26rem)] min-h-80">{sidebarContent}</div> : <div className="pointer-events-none sticky top-[65vh] mt-36 overflow-hidden pt-20"><svg aria-hidden="true" viewBox="0 0 210 190" className="absolute -left-12 top-0 h-44 w-72 opacity-50"><defs><linearGradient id="wave" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="100"><stop stopColor="#2563eb" stopOpacity="0"/><stop offset=".5" stopColor="#38bdf8"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>{Array.from({length:12},(_,i)=><path key={i} d={`M-30 ${100+i*5} C40 ${180-i*4},80 ${-40+i*9},160 ${50+i*7} S240 160,280 60`} stroke="url(#wave)" strokeWidth=".8" fill="none"/>)}</svg><p className="relative mt-16 px-2 text-sm leading-6 text-muted-foreground">Data.<br/>Perspective.<br/>Better questions.</p><div className="ml-2 mt-5 h-0.5 w-8 bg-blue-500"/></div>}
      </aside>
      <main id="main-content" className="min-w-0 flex-1 px-4 pb-8 pt-3 sm:px-6 lg:pr-8">{children}<footer className="mt-10 flex flex-wrap items-center justify-between gap-3 py-4 text-xs text-muted-foreground"><span className="flex items-center gap-2">Zeitgeist <span className="text-blue-400">·</span> A clearer financial perspective <ArrowUpRight size={13}/></span><span>Completed-session data. AI can make mistakes.</span></footer></main>
    </div>
  </div>;
}
