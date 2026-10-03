import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChartNoAxesCombined, MessagesSquare, Bookmark } from 'lucide-react';
import LoginForm from '@/app/login/login-form';
import { Brand } from './brand';
import { BrandSky } from './brand-sky';

export function AuthPage({ signup = false }: { signup?: boolean }) {
  return <main id="main-content" className="terminal-shell grid min-h-dvh text-foreground lg:grid-cols-2">
    <section className="relative isolate hidden flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex xl:p-20"><BrandSky/><div className="relative"><Brand/></div><div className="relative my-16 max-w-md"><p className="app-eyebrow">Your financial perspective starts here</p><h2 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">A little curiosity.<br/><span className="text-cyan-300">A clearer tomorrow.</span></h2><p className="mt-6 leading-8 text-muted-foreground">Bring the data, the interpretation and the conversation into one thoughtful workspace.</p><div className="mt-10 space-y-5">{[[ChartNoAxesCombined,'Research with visible sources'],[MessagesSquare,'Ask your AI CFO better questions'],[Bookmark,'Keep your watchlist and conversations']].map(([Icon,text])=>{const Glyph=Icon as typeof Bookmark;return <p key={String(text)} className="flex items-center gap-3 text-sm text-slate-300"><Glyph size={18} className="text-blue-300"/>{String(text)}</p>;})}</div></div><p className="relative text-xs text-muted-foreground">Research and learning. A perspective, not a promise.</p></section>
    <section className="flex flex-col px-6 py-8 sm:px-12"><Link href="/" className="mb-10 flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/>Back to overview</Link><div className="flex flex-1 items-center justify-center pb-12"><Suspense fallback={<p role="status" className="text-muted-foreground">Preparing your account…</p>}><LoginForm initialMode={signup ? 'signup' : 'signin'}/></Suspense></div><p className="text-center text-xs leading-6 text-muted-foreground">Educational only. Not licensed financial advice.</p></section>
  </main>;
}
