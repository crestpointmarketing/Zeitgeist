"use client";

import type { UIMessage } from 'ai';
import { uiMessageText } from '@/types/cfo';

/** Reloaded failures only contain the saved question; a transport error is not persisted. */
export function ChatRecovery({ messages, busy, error, stopped, onRetry }: {
  messages: UIMessage[];
  busy: boolean;
  error?: Error;
  stopped: boolean;
  onRetry: () => void;
}) {
  const last = messages.at(-1);
  if (busy || error || !messages.some(message => message.role === 'user')) return null;
  if (!stopped && last?.role === 'assistant' && uiMessageText(last).trim()) return null;

  return <div role="status" className="mt-4 rounded-xl border border-blue-300/20 bg-blue-400/5 p-4 text-sm text-muted-foreground">
    <p>{stopped
      ? 'Response stopped. Any partial text shown here may not be saved. You can retry the same question.'
      : 'No completed answer is saved for your last question. You can retry it without typing it again.'}</p>
    <button type="button" onClick={onRetry} className="mt-2 min-h-10 font-medium text-primary underline">Retry answer</button>
  </div>;
}
