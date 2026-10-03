"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Brand } from './brand';
import { usePathname } from 'next/navigation';
import { Menu, X, BarChart3, Home, Sparkles, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

/** Sign-in link when logged out; avatar + sign-out menu when logged in. */
export function AuthControls() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [signOutError, setSignOutError] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); triggerRef.current?.focus(); } };
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', outside); };
  }, [menuOpen]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)).catch(() => setUser(null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);



  if (!user) {
    return (
      <Link
        href="/login"
        className="app-button-secondary"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email?.[0] ?? '?').toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((open) => !open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white transition-transform hover:scale-105"
        ref={triggerRef} aria-expanded={menuOpen} aria-controls="account-menu" aria-label="Account menu"
      >
        {initial}
      </button>
      {menuOpen && (
        <div id="account-menu" className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-white/10 bg-popover p-2 shadow-xl">
          <p className="truncate px-3 py-2 text-xs text-neutral-400">
            {user.email}
          </p>
          <button
            onClick={async () => {
              const supabase = createClient();
              try {
                const result = await supabase?.auth.signOut();
                if (!result || result.error) throw new Error('Sign out failed');
                window.location.assign('/');
              } catch { setSignOutError(true); }
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white transition-colors hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
          {signOutError && <p role="alert" className="p-2 text-xs text-destructive">Could not sign out. Please try again.</p>}
        </div>
      )}
    </div>
  );
}

const links = [
  { href: '/', label: 'Overview', icon: Home },
  { href: '/stock-analysis', label: 'Stock research', icon: BarChart3 },
  { href: '/cfo', label: 'AI CFO', icon: Sparkles },
];
export function Navigation({ className }: { variant?: 'default' | 'transparent'; className?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);
  return <header className={cn('sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-xl', className)}>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:p-3 focus:text-primary-foreground">Skip to content</a>
    <div className="mx-auto flex h-20 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
      <Brand />
      <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined} className={cn('flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors', pathname === href ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}><Icon size={16} />{label}</Link>)}</nav>
      <div className="flex items-center gap-2"><AuthControls /><button className="app-icon-button md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label="Toggle navigation menu">{open ? <X size={21} /> : <Menu size={21} />}</button></div>
    </div>
    {open && <nav id="mobile-navigation" aria-label="Mobile navigation" className="border-t border-border bg-card px-5 py-3 md:hidden">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={pathname === href ? 'page' : undefined} className={cn('my-1 flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm', pathname === href ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}><Icon size={18} />{label}</Link>)}</nav>}
  </header>;
}
export default Navigation;
