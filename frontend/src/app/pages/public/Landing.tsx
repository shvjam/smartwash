import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig, useReducedMotion } from 'motion/react';
import Lenis from 'lenis';
import './landing/landing.css';
import { IntroContext, LenisContext, StartContext } from './landing/kit';
import { Header, Opening, Preloader } from './landing/Opening';
import { About, Features, HowItWorks, Stack } from './landing/Story';
import { Faq, PricingSection } from './landing/Commerce';
import { Cta, Footer, NameMarquee, QuickStart } from './landing/Closing';

/**
 * The public home page.
 *
 * A dark, cinematic page in SmartWash red: the product is shown as it really is (the bay
 * board, an order, a club card, the multi-branch report), the copy only claims what the panel
 * does today, and every price is read from billing. Heavy motion lives behind
 * `prefers-reduced-motion` and the wide-screen breakpoint; phones get a lighter, unpinned
 * version of each section.
 */

let preloaderDecision: boolean | null = null;
/** Like the reference: the intro plays on a fresh visit or a reload, not on every return. */
const shouldPreload = () => {
  if (preloaderDecision !== null) return preloaderDecision;
  if (typeof window === 'undefined') return false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const seen = sessionStorage.getItem('swl_preloaded') === '1';
  sessionStorage.setItem('swl_preloaded', '1');
  preloaderDecision = !reduced && (!seen || nav?.type === 'reload');
  return preloaderDecision;
};

const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Wix+Madefor+Display:wght@400;500;600&display=swap';

export const Landing: React.FC = () => {
  const reduced = useReducedMotion();
  const lenis = useRef<Lenis | null>(null);
  const [preload, setPreload] = useState(shouldPreload);
  const [intro, setIntro] = useState(() => !shouldPreload());
  const [startOpen, setStartOpen] = useState(false);

  // 1rem = 1vw on desktop while this page is open, plus the Latin display face for the wordmark.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('swl-html');
    let link = document.querySelector<HTMLLinkElement>(`link[href="${FONT_HREF}"]`);
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    return () => html.classList.remove('swl-html');
  }, []);

  useEffect(() => {
    if (reduced) return;
    const l = new Lenis({ autoRaf: true, lerp: 0.1 });
    lenis.current = l;
    if (preload) l.stop();
    // Arriving at "/#pricing" from another page should land on that section.
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el instanceof HTMLElement) window.setTimeout(() => l.scrollTo(el, { immediate: true }), 50);
    }
    return () => { l.destroy(); lenis.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!preload) return;
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = ''; lenis.current?.start(); };
  }, [preload]);

  const finishIntro = useCallback(() => { setPreload(false); setIntro(true); }, []);
  const openStart = useCallback(() => setStartOpen(true), []);
  const closeStart = useCallback(() => setStartOpen(false), []);

  return (
    <MotionConfig reducedMotion="user">
      <LenisContext.Provider value={lenis}>
        <StartContext.Provider value={openStart}>
          <IntroContext.Provider value={intro}>
            <div dir="rtl" className="swl">
              <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-black">
                رفتن به محتوا
              </a>
              {preload && <Preloader onDone={finishIntro} />}
              <Header />
              <main id="main">
                <Opening />
                <About />
                <HowItWorks />
                <Features />
                <Stack />
                <PricingSection />
                <Faq />
                <NameMarquee />
                <Cta />
              </main>
              <Footer />
              <QuickStart open={startOpen} onClose={closeStart} />
            </div>
          </IntroContext.Provider>
        </StartContext.Provider>
      </LenisContext.Provider>
    </MotionConfig>
  );
};

export default Landing;
