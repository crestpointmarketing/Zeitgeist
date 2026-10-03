import Image from 'next/image';
import Link from 'next/link';

/** Shared vector mark and live-text wordmark, based on the supplied brand artwork. */
export function Brand() {
  return (
    <Link href="/" aria-label="Zeitgeist home" className="flex shrink-0 items-center gap-3">
      <Image src="/zeitgeist-mark.svg" alt="" width={42} height={40} priority className="shrink-0" />
      <span>
        <span className="block text-xl font-semibold tracking-tight text-white">Zeitgeist</span>
        <span className="mt-0.5 block whitespace-nowrap text-[10px] tracking-wide text-muted-foreground">Financial clarity with AI</span>
      </span>
    </Link>
  );
}
