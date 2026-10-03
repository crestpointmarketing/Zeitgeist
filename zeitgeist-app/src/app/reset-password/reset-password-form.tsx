"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
export default function ResetPasswordForm() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try { const result = await createClient()?.auth.getUser(); if (!cancelled) setReady(Boolean(result?.data.user && !result.error)); }
      catch { if (!cancelled) setReady(false); }
      finally { if (!cancelled) setChecking(false); }
    }
    void check(); return () => { cancelled = true; };
  }, []);
  return <section className="app-panel mx-auto max-w-md p-8"><h1 className="text-2xl font-semibold">Set a new password</h1>{checking ? <p role="status" className="mt-6">Checking your reset link…</p> : done ? <div className="mt-6"><p role="status">Your password has been updated.</p><Link className="app-button mt-5" href="/">Back to your workspace</Link></div> : !ready ? <div className="mt-6"><p>This link is invalid or expired. Request a new link from the sign-in page.</p><Link href="/login" className="app-button mt-5">Back to sign in</Link></div> : <form className="mt-6 space-y-4" onSubmit={async event => {
    event.preventDefault(); setError(null);
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const client = createClient();
      if (!client) throw new Error('Accounts are unavailable.');
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setPassword(''); setConfirm(''); setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update your password.'); }
    finally { setBusy(false); }
  }}><label className="block text-sm" htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={8} className="app-field" value={password} onChange={e => setPassword(e.target.value)}/><label className="block text-sm" htmlFor="confirm-password">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} className="app-field" value={confirm} onChange={e => setConfirm(e.target.value)}/>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<button className="app-button w-full" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button></form>}</section>;
}
