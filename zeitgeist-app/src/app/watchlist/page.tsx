import { WorkspaceShell } from '@/components/workspace-shell';
import { WatchlistPanel } from '@/components/watchlist';
export const metadata = { title: 'Watchlist | Zeitgeist' };
export default function WatchlistPage() { return <WorkspaceShell><WatchlistPanel/></WorkspaceShell>; }
