import React, { Suspense, lazy, useEffect, useState } from 'react';
import { publicPlansApi, type PlanDto } from '../../api';
import { ScrollProgress } from '../../components/landing/kit';
import { Hero } from './landing/Hero';
import { SiteFooter, SiteNav } from './landing/SiteChrome';
import '../../../styles/landing.css';
import '../../../styles/console.css';

/**
 * The public home page.
 *
 * It is ordered the way the decision is made, not the way the software is built: see it
 * working, follow one car through a day, look at the parts, do the sums on your own numbers,
 * see what it tells you once you are off the floor, hear from someone like you, then price,
 * doubts, and the invitation.
 *
 * Only the hero ships in the first chunk. Everything below is split out and mounted as it is
 * reached, so the first thing a visitor on a phone downloads is the thing they will look at:
 * a board that is already moving.
 */

const StageRun = lazy(() => import('./landing/StageRun').then(m => ({ default: m.StageRun })));
const Services = lazy(() => import('./landing/Services').then(m => ({ default: m.Services })));
const Pillars = lazy(() => import('./landing/Pillars').then(m => ({ default: m.Pillars })));
const Payback = lazy(() => import('./landing/Payback').then(m => ({ default: m.Payback })));
const Insight = lazy(() => import('./landing/Insight').then(m => ({ default: m.Insight })));
const Voices = lazy(() => import('./landing/Voices').then(m => ({ default: m.Voices })));
const Plans = lazy(() => import('./landing/Plans').then(m => ({ default: m.Plans })));
const FaqCta = lazy(() => import('./landing/FaqCta').then(m => ({ default: m.FaqCta })));

/** Keeps the page from jumping while a section's code arrives. */
const Hold = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<div className="h-[60vh]" aria-hidden />}>{children}</Suspense>
);

export const Landing: React.FC = () => {
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);

  // Prices come from the billing system, so the page can never quote a stale figure. The
  // calculator uses the same numbers, which is why they are fetched once up here.
  useEffect(() => {
    let alive = true;
    publicPlansApi.list()
      .then(list => { if (alive && list.length) setPlans(list); })
      .catch(() => { /* the section simply shows nothing rather than inventing prices */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const headline = plans.find(p => p.code === 'pro') ?? plans[0];

  return (
    <div className="sw-public sw-console" dir="rtl">
      <ScrollProgress />
      <SiteNav />
      <main>
        <Hero />
        <Hold><StageRun /></Hold>
        <Hold><Services /></Hold>
        <Hold><Pillars /></Hold>
        <Hold><Payback monthlyPriceRials={headline?.monthlyPriceRials} /></Hold>
        <Hold><Insight /></Hold>
        <Hold><Voices /></Hold>
        <Hold><Plans plans={plans} cycle={cycle} onCycle={setCycle} loading={loading} /></Hold>
        <Hold><FaqCta /></Hold>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Landing;
