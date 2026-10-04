"use client";
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';
import { ChartNoAxesCombined, Sparkles, Database, PanelLeftClose, PanelLeftOpen, Menu, X, Star, Info } from 'lucide-react';
import { Brand } from './brand';
import { AuthControls } from './navigation';
import { cn } from '@/lib/utils';
import type { AnchorHTMLAttributes } from 'react';

// Workspace sections intentionally use document navigation. A stale or stalled
// client router must not prevent users from leaving the current workspace.
function WorkspaceLink(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props}/>;
}
const routes = [
  {href:'/stock-analysis',label:'Explore',icon:ChartNoAxesCombined},
  {href:'/cfo',label:'AI CFO',icon:Sparkles},
  {href:'/watchlist',label:'Watchlist',icon:Star},
];
export function WorkspaceShell({children,search,sidebarContent}:{children:ReactNode;search?:ReactNode;sidebarContent?:ReactNode}) {
  const pathname=usePathname();
  const [open,setOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>{
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    const desktop=window.matchMedia('(min-width: 1024px)');
    const resize=()=>{if(desktop.matches)setOpen(false);};
    document.addEventListener('keydown',close); desktop.addEventListener('change',resize);
    return ()=>{document.removeEventListener('keydown',close);desktop.removeEventListener('change',resize);};
  },[]);
  const links=<nav aria-label="Workspace navigation" className="space-y-2">{routes.map(({href,label,icon:Icon})=><WorkspaceLink onClick={()=>setOpen(false)} key={href} href={href} title={collapsed?label:undefined} aria-label={label} aria-current={pathname===href?'page':undefined} className={cn('flex min-h-12 items-center gap-3 rounded-xl border px-3 text-sm',pathname===href?'terminal-active border-blue-400/20 text-white':'border-transparent text-muted-foreground hover:bg-primary/5 hover:text-white')}><Icon className="shrink-0" size={20}/><span className={collapsed?'lg:hidden':''}>{label}</span></WorkspaceLink>)}</nav>;
  return <div className="research-shell min-h-dvh bg-[#06121f] text-foreground">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-primary focus:p-3">Skip to content</a>
    <aside className={cn('fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-[#071522] lg:flex',collapsed?'w-[72px] px-3':'w-[196px] px-4')}>
      <div className="flex h-[72px] shrink-0 items-center">{collapsed?<WorkspaceLink href="/" aria-label="About Zeitgeist"><Image src="/zeitgeist-mark.svg" width={36} height={36} alt=""/></WorkspaceLink>:<Brand/>}</div>
      {links}
      {sidebarContent && !collapsed && <div className="mt-5 min-h-0 flex-1 overflow-y-auto">{sidebarContent}</div>}
      <div className="mt-auto space-y-2 pb-5 pt-8"><WorkspaceLink href="/data" title="Data coverage" aria-label="Data coverage" className="flex min-h-11 items-center gap-3 px-3 text-xs text-muted-foreground hover:text-white"><Database size={18} className="shrink-0"/>{!collapsed&&'Data coverage'}</WorkspaceLink><WorkspaceLink href="/" title="About Zeitgeist" aria-label="About Zeitgeist" className="flex min-h-11 items-center gap-3 px-3 text-xs text-muted-foreground hover:text-white"><Info size={18} className="shrink-0"/>{!collapsed&&'About Zeitgeist'}</WorkspaceLink><button type="button" onClick={()=>setCollapsed(!collapsed)} className="app-icon-button" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<PanelLeftOpen size={19}/>:<PanelLeftClose size={19}/>}</button></div>
    </aside>
    <div className={collapsed?'lg:pl-[72px]':'lg:pl-[196px]'}>
      <header className="sticky top-0 z-30 flex min-h-[72px] flex-wrap items-center gap-3 border-b border-border bg-[#06121ff5] px-4 py-3 backdrop-blur-lg sm:px-6">
        <div className="mr-auto lg:hidden"><Brand/></div>
        {search && <div className="order-3 w-full min-w-0 lg:order-none lg:mr-auto lg:w-auto lg:max-w-2xl lg:flex-1">{search}</div>}
        <div className="ml-auto flex items-center gap-1"><AuthControls/><button className="app-icon-button lg:hidden" aria-label={open?'Close navigation':'Open navigation'} aria-expanded={open} aria-controls="workspace-mobile-nav" onClick={()=>setOpen(!open)}>{open?<X size={21}/>:<Menu size={21}/>}</button></div>
        {open&&<div id="workspace-mobile-nav" className="order-4 max-h-[65dvh] w-full overflow-y-auto rounded-xl border border-border bg-[#071522] p-3 lg:hidden">{links}<WorkspaceLink className="flex min-h-11 items-center gap-3 px-3 text-sm text-muted-foreground" href="/data" onClick={()=>setOpen(false)}><Database size={18}/>Data coverage</WorkspaceLink>{sidebarContent&&<div className="mt-4 h-72">{sidebarContent}</div>}</div>}
      </header>
      <main id="main-content" className="mx-auto min-w-0 max-w-[1600px] p-4 sm:p-6">{children}</main>
    </div>
  </div>;
}
