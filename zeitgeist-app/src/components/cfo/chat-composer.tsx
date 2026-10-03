"use client";

import React, { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  onSend: (text: string) => void;
  onStop: () => void;
  streaming: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}

export function ChatComposer({
  onSend,
  onStop,
  streaming,
  disabled = false,
  autoFocus = false,
  compact = false,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const resize = () => {
      el.style.height = 'auto';
      const limit = compact ? 96 : 160;
      el.style.height = `${Math.max(44, Math.min(el.scrollHeight, limit))}px`;
      el.style.overflowY = el.scrollHeight > limit ? 'auto' : 'hidden';
    };
    resize();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        resize();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value, compact]);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming || disabled) return;
    onSend(text);
    setValue("");
  };

  return (
    <div
      className={cn(
        "flex items-end gap-2 rounded-2xl border border-input bg-card px-4 py-3",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        rows={1}
        maxLength={4000}
        placeholder="Ask the CFO anything about money…"
        aria-label="Message to AI CFO"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className={cn(
          "cfo-message-input min-w-0 min-h-11 max-h-40 flex-1 resize-none overflow-y-hidden bg-transparent py-2.5 leading-6 text-white placeholder:text-muted-foreground focus:outline-none",
          compact ? "text-sm" : "text-[15px]"
        )}
      />
      {streaming ? (
        <button
          onClick={onStop}
          aria-label="Stop generating"
          className="mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!value.trim() || disabled}
          aria-label="Send message"
          className={cn(
            "mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-700",
            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
