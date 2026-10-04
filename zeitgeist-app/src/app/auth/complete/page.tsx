import type { Metadata } from 'next';
import EmailLinkCompletion from './email-link-completion';

export const metadata: Metadata = { title: 'Verify email link | Zeitgeist', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function Page() { return <EmailLinkCompletion/>; }
