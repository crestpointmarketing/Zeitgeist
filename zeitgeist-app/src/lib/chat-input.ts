import { z } from 'zod';
import type { UIMessage } from 'ai';

export const chatRequestSchema = z.object({
  conversationId: z.string().uuid(),
  messages: z.array(z.object({
    id: z.string().min(1).max(128), role: z.enum(['user', 'assistant']),
    parts: z.array(z.object({ type: z.literal('text'), text: z.string().max(12000) })).min(1).max(8),
  })).min(1).max(20),
});

/** The same bounded text-only context is used by client and server. */
export function boundedMessages(messages: UIMessage[]): UIMessage[] {
  const result: UIMessage[] = [];
  let characters = 0;
  for (const message of messages.slice(-20).reverse()) {
    const text = message.parts.filter(part => part.type === 'text').map(part => part.text).join('');
    if (characters + text.length > 20000) break;
    characters += text.length;
    result.unshift({ id: message.id, role: message.role, parts: [{ type: 'text', text }] });
  }
  return result;
}
