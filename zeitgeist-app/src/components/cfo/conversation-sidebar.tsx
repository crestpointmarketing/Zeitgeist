"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Check, LogOut, Pencil, Plus, Trash2, X } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types/cfo";

interface ConversationSidebarProps {
  embedded?: boolean;
  activeId: string | null;
  refreshKey: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
}

export function ConversationSidebar({
  embedded = false,
  activeId,
  refreshKey,
  onSelect,
  onNew,
  onDeleted,
}: ConversationSidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null)).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    async function load() {
      try {
        const supabase = createClient();
        if (!supabase) throw new Error('Accounts unavailable');
        const { data, error } = await supabase.from('conversations').select('id, title, updated_at').order('updated_at', { ascending: false });
        if (error) throw error;
        if (!cancelled) setConversations((data as Conversation[]) ?? []);
      } catch { if (!cancelled) setError('Could not load conversations.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [refreshKey, retryKey]);

  const renameConversation = async (id: string) => {
    const title = editingTitle.trim().slice(0, 120);
    if (!title || saving) return;
    setSaving(true); setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Accounts unavailable');
      const { data, error } = await supabase.from('conversations').update({ title }).eq('id', id).select('id').single();
      if (error || !data) throw new Error('Update failed');
      setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
      setEditingId(null);
    } catch { setError('Could not rename the conversation. Your changes were not saved.'); }
    finally { setSaving(false); }
  };

  const deleteConversation = async (id: string) => {
    if (saving || !window.confirm('Delete this conversation?')) return;
    setSaving(true); setError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Accounts unavailable');
      const { data, error } = await supabase.from('conversations').delete().eq('id', id).select('id').single();
      if (error || !data) throw new Error('Delete failed');
      setConversations(prev => prev.filter(c => c.id !== id));
      onDeleted(id);
    } catch { setError('Could not delete the conversation. Please try again.'); }
    finally { setSaving(false); }
  };

  return (
    <div className={cn("flex h-full flex-col", !embedded && "bg-sidebar")}>
      {/* Header */}
      <div className={cn("flex items-center justify-between p-4", embedded && "hidden")}>
        <Brand />
      </div>

      <div className="px-3">
        <button
          onClick={onNew}
          className="app-button w-full"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="px-5 pt-7 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Conversations</div>
      {/* Conversation list */}
      <div className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {error && <p role="alert" className="p-2 text-xs text-destructive">{error} <button className="underline" onClick={() => setRetryKey(k => k + 1)}>Reload</button></p>}
        {loading && <p role="status" className="p-2 text-xs text-muted-foreground">Loading conversations…</p>}
        {!loading && !error && conversations.length === 0 && (
          <p className="px-2 py-4 text-center text-[13px] text-muted-foreground">
            {embedded ? "No conversations yet." : "Your saved conversations will appear here."}
          </p>
        )}
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={cn(
              "group flex items-center rounded-xl transition-colors",
              conversation.id === activeId
                ? "bg-white/10"
                : "hover:bg-white/5"
            )}
          >
            {editingId === conversation.id ? (
              <div className="flex w-full items-center gap-1 px-2 py-1.5">
                <input
                  maxLength={120}
                  autoFocus
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameConversation(conversation.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  aria-label="Conversation name"
                  className="app-field min-w-0"
                />
                <button
                  onClick={() => renameConversation(conversation.id)}
                  className="p-2 text-muted-foreground hover:text-white"
                  disabled={saving} aria-label="Save name"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-2 text-muted-foreground hover:text-white"
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelect(conversation.id)}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] text-neutral-200"
                  title={conversation.title}
                >
                  {conversation.title}
                </button>
                <div className="flex shrink-0 items-center pr-2 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <button
                    onClick={() => {
                      setEditingId(conversation.id);
                      setEditingTitle(conversation.title);
                    }}
                    className="p-2 text-muted-foreground hover:text-white"
                    aria-label="Rename conversation"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteConversation(conversation.id)}
                    className="p-2 text-muted-foreground hover:text-red-400"
                    disabled={saving} aria-label="Delete conversation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="truncate text-xs text-muted-foreground">
            {user?.email ?? ""}
          </span>
          {user ? <button
            onClick={async () => {
              const supabase = createClient();
              try {
                const result = await supabase?.auth.signOut();
                if (!result || result.error) throw new Error('Sign out failed');
                window.location.assign('/');
              } catch { setError('Could not sign out. Please try again.'); }
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button> : <Link href="/login?next=%2Fcfo" className="app-button-secondary w-full">{embedded ? "Sign in" : "Sign in to save conversations"}</Link>}
        </div>
      </div>
    </div>
  );
}
