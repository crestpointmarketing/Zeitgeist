import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { RequestError } from '@/lib/api-access';

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function claimGeneration<T>(key: string, hash: string, conversationId?: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_generation', {
    p_key: key, p_fingerprint: hash, p_conversation: conversationId ?? null,
  });
  if (error || !data) throw new RequestError('Generation storage is unavailable.', 503);
  if (data.state === 'conflict') throw new RequestError('This request ID was already used for different content.', 409);
  const finish = async (result: T | null) => {
    const { data: saved, error: saveError } = await admin.rpc('finish_generation', {
      p_key: key, p_lease: data.lease_id, p_result: result,
    });
    if (saveError || !saved) throw new RequestError('Could not save the generated result. Please retry.', 503);
  };
  return { state: data.state as 'claimed' | 'pending' | 'ready', result: data.result as T | undefined, finish };
}
