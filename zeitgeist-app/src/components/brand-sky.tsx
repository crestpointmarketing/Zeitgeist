"use client";
import { useEffect, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { StarsBackground } from './ui/stars-background';
import { ShootingStars } from './ui/shooting-stars';

/** Original sky animation, respecting reduced motion and hidden tabs. */
export function BrandSky() {
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(!preference.matches && !document.hidden);
    update();
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return <>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="brand-nebula absolute inset-0" />
      {enabled && !paused && <><StarsBackground starDensity={0.00007} className="opacity-40" /><ShootingStars minDelay={3500} maxDelay={7000} minSpeed={8} maxSpeed={15} starColor="#5ae6ee" trailColor="#3979ff" /></>}
    </div>
    {enabled && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play background animation' : 'Pause background animation'} className="absolute bottom-5 right-5 z-10 rounded-full border border-white/15 bg-background/80 p-3 text-muted-foreground hover:text-white">{paused ? <Play size={16} /> : <Pause size={16} />}</button>}
  </>;
}
