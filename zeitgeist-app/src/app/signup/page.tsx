import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth-page';
export const metadata: Metadata = { title: 'Create your account | Zeitgeist', description: 'Start your stock research, save a watchlist and ask your AI CFO financial questions.' };
export default function SignupPage() { return <AuthPage signup/>; }
