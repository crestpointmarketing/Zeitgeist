import { anthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { CFO_SYSTEM_PROMPT } from '@/lib/cfo-prompt';
import { uiMessageText } from '@/types/cfo';
import { boundedMessages, chatRequestSchema } from '@/lib/chat-input';
import { readJson, requireAccount, reserveUsage, RequestError } from '@/lib/api-access';
import { claimGeneration, fingerprint } from '@/lib/generation-cache';
import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 60;

function replay(text: string) {
  return createUIMessageStreamResponse({ stream: createUIMessageStream({ execute({ writer }) {
    writer.write({ type: 'text-start', id: 'reply' });
    writer.write({ type: 'text-delta', id: 'reply', delta: text });
    writer.write({ type: 'text-end', id: 'reply' });
  } }) });
}

export async function POST(request: Request) {
  let release: (() => Promise<void>) | undefined;
  let failClaim: (() => Promise<void>) | undefined;
  try {
    const { supabase, user } = await requireAccount();
    const parsed = chatRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new RequestError('Invalid conversation or messages.', 400);
    const { conversationId } = parsed.data;
    const messages = boundedMessages(parsed.data.messages);
    const last = messages.at(-1);
    const text = uiMessageText(last).trim();
    if (last?.role !== 'user' || !text || text.length > 4000) throw new RequestError('Send a message between 1 and 4,000 characters.', 400);
    const admin = createAdminClient();
    const { error: conversationError } = await supabase.from('conversations').upsert(
      { id: conversationId, user_id: user.id, title: text.slice(0, 48) }, { onConflict: 'id', ignoreDuplicates: true },
    );
    if (conversationError) throw new RequestError('Could not open conversation.', 503);
    const { data: conversation, error: ownershipError } = await supabase.from('conversations').select('id').eq('id', conversationId).maybeSingle();
    if (ownershipError || !conversation) throw new RequestError('Conversation not found.', 403);

    const claim = await claimGeneration<{ text: string }>('chat:' + conversationId + ':' + last.id, fingerprint(text), conversationId);
    if (claim.state === 'ready') return replay(claim.result!.text);
    if (claim.state === 'pending') throw new RequestError('This message is already being answered. Retry shortly.', 409);
    failClaim = () => claim.finish(null);

    // If a reply was persisted but the final cache write failed, recover it without another model call.
    const { data: storedReply, error: replyReadError } = await supabase.from('messages').select('content')
      .eq('conversation_id', conversationId).eq('role', 'assistant').eq('client_message_id', last.id).maybeSingle();
    if (replyReadError) throw new RequestError('Could not load the saved reply.', 503);
    if (storedReply) { await claim.finish({ text: storedReply.content }); return replay(storedReply.content); }
    if (!process.env.ANTHROPIC_API_KEY) throw new RequestError('Chat is not configured yet.', 503);
    release = await reserveUsage(supabase, 'chat');
    const { error: saveError } = await admin.from('messages').upsert({
      conversation_id: conversationId, role: 'user', content: text, client_message_id: last.id,
    }, { onConflict: 'conversation_id,role,client_message_id', ignoreDuplicates: true });
    if (saveError) throw new RequestError('Could not save your message.', 503);

    const releaseLease = release;
    const failed = async () => { await claim.finish(null).catch(() => {}); await releaseLease(); };
    const result = streamText({
      model: anthropic(process.env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-5-5'), system: CFO_SYSTEM_PROMPT,
      providerOptions: (process.env.ANTHROPIC_CHAT_MODEL || 'claude-sonnet-5-5') === 'claude-sonnet-5-5'
        ? { anthropic: { thinking: { type: 'between_tools' }, effort: 'medium' } }
        : undefined,
      messages: await convertToModelMessages(messages), maxOutputTokens: 1200, maxRetries: 0,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(50000)]),
      onError: failed, onAbort: failed,
      onFinish: async ({ text: reply, finishReason }) => {
        try {
          if (!reply || !['stop', 'length'].includes(finishReason)) { await claim.finish(null); return; }
          const { error } = await admin.from('messages').upsert({
            conversation_id: conversationId, role: 'assistant', content: reply, client_message_id: last.id,
          }, { onConflict: 'conversation_id,role,client_message_id', ignoreDuplicates: true });
          if (error) throw new Error('Could not persist CFO reply');
          await claim.finish({ text: reply });
          const { error: updateError } = await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
          if (updateError) console.error('Could not update conversation', updateError.code);
        } catch (error) {
          await claim.finish(null).catch(() => {});
          throw error; // propagate a stream error so the UI can retry/recover
        } finally { await releaseLease(); }
      },
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    await failClaim?.().catch(() => {});
    await release?.();
    return Response.json({ error: error instanceof RequestError ? error.message : 'Chat is temporarily unavailable.' }, {
      status: error instanceof RequestError ? error.status : 500, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
