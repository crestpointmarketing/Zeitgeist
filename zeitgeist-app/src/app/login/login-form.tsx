"use client";

import React, { useEffect, useState } from "react";
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Brand } from "@/components/brand";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

import { safeRedirectPath } from '@/lib/auth-redirect';
import { authLinkNotice } from '@/lib/auth-link';

type Mode = "signin" | "signup" | "reset";

export default function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"), '/stock-analysis');

  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState(() => authLinkNotice(searchParams.get('error')));
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!authLinkNotice(url.searchParams.get('error'))) return;
    // Recover links already redirected by the older callback implementation.
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (fragment.has('access_token') || fragment.has('error')) {
      window.location.replace(`/auth/complete?next=${encodeURIComponent(next)}${url.hash}`);
      return;
    }
    for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLinkNotice(null);
    if (mode === 'signup' && password !== confirmation) {
      setError('Passwords do not match. Please check both fields.');
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setError("Sign-in is temporarily unavailable. Please try again later.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Full navigation so the server sees the new session cookie.
        window.location.assign(next);
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/callback?next=%2Freset-password` });
        if (error) throw error;
        setNotice('If an account exists for this address, a password reset link will arrive shortly. Open it in this browser.');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign(next);
        } else {
          setPassword('');
          setConfirmation('');
          setShowPassword(false);
          setNotice(
            "If this email address needs confirmation, follow the link in your inbox before signing in. If you already have an account, sign in with your existing password."
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="auth-form-intro mb-5 text-center">
        <div className="mb-5 flex justify-center lg:hidden"><Brand/></div>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          {mode === "reset" ? "Reset your password." : mode === "signin" ? "Welcome back." : "Create your account."}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {mode === "reset" ? "We’ll send a link to your email address." : mode === "signin"
            ? "Return to your research and financial conversations."
            : "One account for stock research and your AI CFO."}
        </p>
      </div>

      {mode !== 'reset' && <nav aria-label="Account access" className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border p-1">
        <Link href={`/login?next=${encodeURIComponent(next)}`} aria-current={mode === 'signin' ? 'page' : undefined} className={cn('rounded-lg px-3 py-2.5 text-center text-sm font-medium', mode === 'signin' ? 'bg-primary/20 text-white' : 'text-muted-foreground hover:text-white')}>Sign in</Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} aria-current={mode === 'signup' ? 'page' : undefined} className={cn('rounded-lg px-3 py-2.5 text-center text-sm font-medium', mode === 'signup' ? 'bg-primary/20 text-white' : 'text-muted-foreground hover:text-white')}>Create account</Link>
      </nav>}

      <div className="app-panel p-5 sm:p-6">
        {linkNotice && <div role="status" className="mb-5 rounded-xl border border-border bg-primary/5 p-4 text-sm leading-6">
          <p className="font-medium">About your email link</p>
          <p className="mt-2 text-muted-foreground">{linkNotice}</p>
          <button type="button" className="mt-3 text-primary underline" onClick={() => { setMode('reset'); setLinkNotice(null); setError(null); setNotice(null); setPassword(''); }}>Request a new reset link</button>
        </div>}
        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-xl bg-yellow-500/10 px-4 py-3 text-[13px] text-yellow-300">
            Sign-in is temporarily unavailable. Please try again later.
          </p>
        )}

        {mode === 'signup' && notice ? <div className="space-y-5">
          <h2 className="text-xl font-semibold">Next step: sign in</h2>
          <p role="status" className="text-sm leading-7 text-muted-foreground">{notice}</p>
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="app-button w-full">Go to sign in</Link>
          <button type="button" className="w-full text-center text-sm text-primary hover:underline" onClick={() => { setNotice(null); setError(null); }}>Use a different email</button>
        </div> : <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setLinkNotice(null); }}
            className="app-field"
          />
          {mode !== "reset" && <><label className="block text-sm font-medium" htmlFor="password">Password</label>
          <div className="relative"><input
            id="password"
            type={showPassword ? 'text' : 'password'}
            required
            minLength={mode === 'signup' ? 8 : 6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setLinkNotice(null); }}
            className="app-field pr-14"
          /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} className="app-icon-button absolute right-1 top-0.5" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          {mode === 'signup' && <><p className="text-xs text-muted-foreground">Use at least 8 characters.</p><label htmlFor="confirm-password" className="block text-sm font-medium">Confirm password</label><input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} className="app-field" placeholder="Repeat your password"/></>}

          </>}
          {mode === "signin" && <button type="button" disabled={busy} className="text-sm text-primary hover:underline" onClick={() => { setMode("reset"); setError(null); setNotice(null); }}>Forgot password?</button>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm text-primary">{notice}</p>}

          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            className={cn(
              "app-button w-full",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            {busy
              ? "One moment…"
              : mode === "signin"
                ? "Sign in"
                : mode === "reset" ? "Send reset link" : "Create account"}
          </button>
        </form>}
      </div>

      {mode === 'reset' && <p className="mt-4 text-center text-sm text-muted-foreground">
          <button type="button" disabled={busy} className="text-primary hover:underline" onClick={() => { setMode('signin'); setError(null); setNotice(null); }}>Back to sign in</button>
      </p>}
    </div>
  );
}
