import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing-page';
export const metadata: Metadata = { title: 'Zeitgeist — Financial clarity with AI', description: 'Stock research, evidence-based AI perspectives and an AI CFO. Build a clearer financial perspective with Zeitgeist.' };
export default function Home() { return <LandingPage/>; }
