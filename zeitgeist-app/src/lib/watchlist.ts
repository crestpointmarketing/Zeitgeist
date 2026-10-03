/** Account preferences only: never use user-editable metadata for authorization. */
export const WATCHLIST_LIMIT = 30;
export function watchlistSymbols(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && /^[A-Z]{1,5}$/.test(item)))].slice(0, WATCHLIST_LIMIT);
}
