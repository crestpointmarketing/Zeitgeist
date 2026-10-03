const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validConversationId(value: string | null): value is string { return Boolean(value && UUID.test(value)); }
export function lastConversation(userId: string): string | null {
  try { const id = sessionStorage.getItem(`cfo:${userId}:conversationId`); return validConversationId(id) ? id : null; }
  catch { return null; }
}
export function rememberConversation(userId: string, id: string) {
  try { if (validConversationId(id)) sessionStorage.setItem(`cfo:${userId}:conversationId`, id); }
  catch { /* Storage-disabled browsers can still use chat. */ }
}
