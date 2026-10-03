import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChartNoAxesCombined, MessagesSquare, Bookmark } from 'lucide-react';
import type { Metadata } from 'next';
import LoginForm from './login-form';
import { Brand } from '@/components/brand';
export const metadata: Metadata = {title:'Sign in | Zeitgeist',description:'Access your stock research and AI CFO conversations.'};
export default function LoginPage() {
  return <main id="main-content" className="grid terminal-shell min-h-dvh bg-background text-foreground lg:grid-cols-2"><section className="relative hidden flex-col justify-between border-r border-border bg-sidebar p-12 lg:flex xl:p-20"><Brand/><div className="my-16 max-w-md"><p className="app-eyebrow">A workspace for financial clarity</p><h2 className="mt-5 text-5xl font-semibold leading-tight tracking-tight">Your questions.<br/><span className="text-primary">A clearer perspective.</span></h2><p className="mt-6 leading-relaxed text-muted-foreground">Keep the data, the interpretation and the conversation in one place.</p><div className="mt-10 space-y-5">{[[ChartNoAxesCombined,'Research with visible sources'],[MessagesSquare,'Talk through financial questions'],[Bookmark,'Return to saved conversations']].map(([Icon,text])=>{const Glyph=Icon as typeof Bookmark;return <p key={String(text)} className="flex items-center gap-3 text-sm text-muted-foreground"><Glyph size={18} className="text-primary"/>{String(text)}</p>;})}</div></div><p className="text-xs text-muted-foreground">Built for research and learning.</p></section><section className="flex flex-col px-6 py-8 sm:px-12"><Link href="/" className="mb-10 flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16}/>Back to overview</Link><div className="flex flex-1 items-center justify-center pb-12"><Suspense fallback={<p role="status" className="text-muted-foreground">Preparing sign-in…</p>}><LoginForm/></Suspense></div></section></main>;
}
