import {Suspense} from 'react';
import {WorkspaceShell} from '@/components/workspace-shell';
import {ResearchCenter} from '@/components/research-center';
export const metadata={title:'Research tasks | Zeitgeist'};
export default function ResearchPage(){return <WorkspaceShell><Suspense fallback={<p>Loading research…</p>}><ResearchCenter/></Suspense></WorkspaceShell>;}
