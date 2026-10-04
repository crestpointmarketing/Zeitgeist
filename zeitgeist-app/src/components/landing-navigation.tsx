"use client";
import Link from 'next/link';
import { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Brand } from './brand';

export function LandingNavigation() {
  const [open, setOpen] = useState(false);
  return <header className="relative z-20 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8" onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}>
    <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a><Brand/>
    <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm md:flex"><a href="#product-tour" className="text-muted-foreground hover:text-white">Product tour</a><a href="#how-it-works" className="text-muted-foreground hover:text-white">How it works</a><Link href="/stock-analysis" className="text-muted-foreground hover:text-white">Workspace</Link><Link href="/login">Sign in</Link><Link href="/signup" className="app-button">Get started <ArrowUpRight size={16}/></Link></nav>
    <button type="button" className="app-icon-button md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="landing-mobile-nav" onClick={() => setOpen(!open)}>{open ? <X size={22}/> : <Menu size={22}/>}</button>
    {open && <nav id="landing-mobile-nav" aria-label="Mobile navigation" className="grid w-full gap-1 rounded-2xl border border-border bg-card p-3 md:hidden" onClick={() => setOpen(false)}><a className="rounded-lg px-4 py-3" href="#product-tour">Product tour</a><a className="rounded-lg px-4 py-3" href="#how-it-works">How it works</a><Link className="rounded-lg px-4 py-3" href="/stock-analysis">Workspace</Link><Link className="rounded-lg px-4 py-3" href="/login">Sign in</Link><Link className="app-button mt-2" href="/signup">Create your account <ArrowUpRight size={16}/></Link></nav>}
  </header>;
}
