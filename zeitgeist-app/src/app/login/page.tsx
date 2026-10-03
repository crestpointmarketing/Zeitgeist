import type { Metadata } from 'next';
import { AuthPage } from '@/components/auth-page';
export const metadata: Metadata = { title: 'Sign in | Zeitgeist', description: 'Access your stock research and AI CFO conversations.' };
export default function LoginPage() { return <AuthPage/>; }
