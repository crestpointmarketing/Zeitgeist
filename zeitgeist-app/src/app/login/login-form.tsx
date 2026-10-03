"use client";

import React, { useState } from "react";
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { Brand } from "@/components/brand";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

import { safeRedirectPath } from '@/lib/auth-redirect';

type Mode = "signin" | "signup" | "reset";

export default function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const next = safeRedirectPath(searchParams.get("next"), '/stock-analysis');

  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error") === "auth_callback" ? "This sign-in link is invalid or expired. Please request a new link." : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
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
          email,
          password,
        });
        if (error) throw error;
        // Full navigation so the server sees the new session cookie.
        window.location.assign(next);
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=%2Freset-password` });
        if (error) throw error;
        setNotice('If an account exists for this address, a password reset link will arrive shortly. Open it in this browser.');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) throw error;
        if (data.session) {
          window.location.assign(next);
        } else {
          setNotice(
            "Check your email to confirm your account, then sign in."
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
          {mode === "reset" ? "Reset your password." : mode === "signin" ? "Welcome back." : "Make room for clarity."}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground">
          {mode === "reset" ? "We’ll send a link to your email address." : mode === "signin"
            ? "Return to your research and financial conversations."
            : "One account for stock research and your AI CFO."}
        </p>
      </div>

      <div className="app-panel p-5 sm:p-6">
        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-xl bg-yellow-500/10 px-4 py-3 text-[13px] text-yellow-300">
            Sign-in is temporarily unavailable. Please try again later.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            onChange={(e) => setPassword(e.target.value)}
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
        </form>
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        {mode === "signin" ? (
          <>
            New to Zeitgeist?{" "}
            <Link
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="text-primary hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : mode === 'reset' ? (
          <button type="button" disabled={busy} className="text-primary hover:underline" onClick={() => { setMode('signin'); setError(null); setNotice(null); }}>Back to sign in</button>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="text-primary hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
