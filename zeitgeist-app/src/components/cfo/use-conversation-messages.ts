"use client";
import { useCallback, useEffect, useState } from 'react';
import type { UIMessage } from 'ai';
import { uiMessagesFromDb, type DbMessage } from '@/types/cfo';

/** Failed reads must never silently become a new, empty conversation. */
export function useConversationMessages(conversationId: string | null) {
  const [state, setState] = useState<{ id: string | null; messages: UIMessage[] | null; error: string | null }>({ id: null, messages: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    let cancelled = false;
    setState({ id: conversationId, messages: null, error: null });
    async function load() {
      try {
        if (!conversationId) return;
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        if (!supabase) throw new Error('Accounts unavailable');
        const { data, error } = await supabase.from('messages')
          .select('id, role, content, created_at, client_message_id')
          .eq('conversation_id', conversationId).order('created_at', { ascending: true });
        if (error) throw error;
        if (!cancelled) setState({ id: conversationId, messages: uiMessagesFromDb((data as DbMessage[]) ?? []), error: null });
      } catch {
        if (!cancelled) setState({ id: conversationId, messages: null, error: 'Could not load your saved messages. Please retry before sending a new message.' });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [conversationId, attempt]);
  return { messages: state.id === conversationId ? state.messages : null, error: state.id === conversationId ? state.error : null, retry };
}
