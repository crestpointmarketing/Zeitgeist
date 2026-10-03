import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChartNoAxesCombined, MessagesSquare, Bookmark } from 'lucide-react';
import LoginForm from '@/app/login/login-form';
import { Brand } from './brand';
import { BrandSky } from './brand-sky';

export function AuthPage({ signup = false }: { signup?: boolean }) {
  return <main id="main-content" className="terminal-shell flex min-h-dvh items-center justify-center p-4 text-foreground sm:p-6"><div className="auth-card grid w-full max-w-[1120px] overflow-hidden rounded-3xl border border-border bg-background lg:grid-cols-2">
    <section className="relative isolate hidden flex-col justify-between overflow-hidden border-r border-border p-8 lg:flex xl:p-10"><BrandSky/><div className="relative"><Brand/></div><div className="relative my-8 max-w-md"><p className="app-eyebrow">Your financial perspective starts here</p><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight">A little curiosity.<br/><span className="text-cyan-300">A clearer tomorrow.</span></h2><p className="mt-5 leading-7 text-muted-foreground">Bring the data, the interpretation and the conversation into one thoughtful workspace.</p><div className="mt-7 space-y-4">{[[ChartNoAxesCombined,'Research with visible sources'],[MessagesSquare,'Ask your AI CFO better questions'],[Bookmark,'Keep your watchlist and conversations']].map(([Icon,text])=>{const Glyph=Icon as typeof Bookmark;return <p key={String(text)} className="flex items-center gap-3 text-sm text-slate-300"><Glyph size={18} className="text-blue-300"/>{String(text)}</p>;})}</div></div><p className="relative text-xs text-muted-foreground">Research and learning. A perspective, not a promise.</p></section>
    <section className="flex flex-col px-5 py-5 sm:px-8"><Link href="/" className="mb-3 flex min-h-11 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/>Back to overview</Link><div className="flex flex-1 items-center justify-center pb-4"><Suspense fallback={<p role="status" className="text-muted-foreground">Preparing your account…</p>}><LoginForm initialMode={signup ? 'signup' : 'signin'}/></Suspense></div><p className="text-center text-xs leading-6 text-muted-foreground">Educational only. Not licensed financial advice.</p></section>
  </div></main>;
}
