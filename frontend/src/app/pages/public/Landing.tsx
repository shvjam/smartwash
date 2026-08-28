import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router';
import '../../../styles/landing.css';
import { laptopPng } from './landingAssets';
import { publicPlansApi, type PlanDto } from '../../api';
import { visiblePlanFeatureLabels } from '../../lib/planFeatures';

/* ── Images ──────────────────────────────────────────── */
const IMGS = {
  ferrari: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=900&q=80&auto=format&fit=crop',
  wash:    'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?w=800&q=80&auto=format&fit=crop',
  microf:  'https://images.unsplash.com/photo-1761934658331-2e00b20dc6c6?w=800&q=80&auto=format&fit=crop',
  blue:    'https://images.unsplash.com/photo-1747811853874-c00a51195d54?w=800&q=80&auto=format&fit=crop',
};

const marquee = [
  '۲۵۰+ کارواش فعال', '۱.۲ میلیون سفارش پردازش‌شده',
  'رزرو آنلاین و باشگاه مشتریان', '۹۸٪ رضایت کاربران',
  'گزارش‌های زنده', 'پشتیبانی فارسی ۲۴/۷',
];

const testimonials = [
  { name:'علی محمدی', role:'مدیر کارواش پارس، تهران', color:'#E8262C',
    text:'از وقتی SmartWash راه انداختیم درآمد ۳۵٪ بیشتر شده. هیچ مشتری‌ای منتظر نمی‌مونه و مدیریت صف‌ها کاملاً خودکار شده.' },
  { name:'سارا کریمی', role:'مالک کارواش نیاوران', color:'#7c3aed',
    text:'سیستم رزرو فوق‌العاده. مشتری‌ها از راه رزرو می‌کنن و ما تقویم کامل می‌بینیم. ساعت‌های خلوت معجزه‌آسا پر شد.' },
  { name:'رضا سلیمانی', role:'مدیرعامل زنجیره ۴ کارواش', color:'#0891b2',
    text:'گزارش چندشعبه‌ای، تسویه کارگرها، کیف‌پول مشتری — همه یک‌جاست. تیم پشتیبانی هم سریع و حرفه‌ای جواب می‌ده.' },
];

/* ── SVG icons (reusable) ────────────────────────────── */
const Ico = {
  dash:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  crm:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  cal:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  fin:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  staff: <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  star:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.9 6.5L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.09-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  shield:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  zap:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>,
  head:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" stroke="currentColor" strokeWidth="1.6"/></svg>,
  mac:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>,
  arrow: <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  phone: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  play:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 3l14 9-14 9V3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  tg:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  ig:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>,
  ssl:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
  dd:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
};

/* ════════════════════════════════════════════════════════
   COMPONENT
════════════════════════════════════════════════════════ */
export const Landing: React.FC = () => {
  const [scrolled,   setScrolled]   = useState(false);
  const [cmpPos,     setCmpPos]     = useState(50);
  const [hintOff,    setHintOff]    = useState(false);
  const [clubVis,    setClubVis]    = useState(false);
  const [galActive,  setGalActive]  = useState(0);
  const [planCycle, setPlanCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [publicPlans, setPublicPlans] = useState<PlanDto[]>([]);

  const cmpRef     = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const userPaused = useRef(false);

  useEffect(() => { publicPlansApi.list().then(setPublicPlans).catch(() => setPublicPlans([])); }, []);
  const toman = (rials: number) => new Intl.NumberFormat('fa-IR').format(Math.round(rials / 10));

  /* nav scroll */
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn, { passive: true }); fn();
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* compare auto-sweep */
  useEffect(() => {
    let id: number; let pos = 100;
    const sw = () => { pos -= 1.2; if (pos <= 50) { setCmpPos(50); return; } setCmpPos(pos); if (!isDragging.current) id = requestAnimationFrame(sw); };
    const t = setTimeout(() => { if (!isDragging.current) id = requestAnimationFrame(sw); }, 1800);
    return () => { clearTimeout(t); cancelAnimationFrame(id); };
  }, []);

  useEffect(() => {
    const mm = (e: MouseEvent) => { if (!isDragging.current || !cmpRef.current) return; const r = cmpRef.current.getBoundingClientRect(); setCmpPos(Math.max(4, Math.min(96, ((e.clientX - r.left) / r.width) * 100))); };
    const mu = () => { isDragging.current = false; };
    const tm = (e: TouchEvent) => { if (!isDragging.current || !cmpRef.current) return; const r = cmpRef.current.getBoundingClientRect(); setCmpPos(Math.max(4, Math.min(96, ((e.touches[0].clientX - r.left) / r.width) * 100))); };
    window.addEventListener('mousemove', mm); window.addEventListener('mouseup', mu);
    window.addEventListener('touchmove', tm, { passive: true }); window.addEventListener('touchend', mu);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', mu); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', mu); };
  }, []);

  const startCmp = useCallback((x: number) => {
    isDragging.current = true; setHintOff(true);
    if (!cmpRef.current) return;
    const r = cmpRef.current.getBoundingClientRect();
    setCmpPos(Math.max(4, Math.min(96, ((x - r.left) / r.width) * 100)));
  }, []);

  /* count-up */
  useEffect(() => {
    const toFa = (n: number) => n.toLocaleString('en-US').replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);
    const setVal = (el: Element, val: string) => {
      // Update the existing text node in-place so React's fiber reference stays valid.
      const tn = el.firstChild;
      if (tn && tn.nodeType === Node.TEXT_NODE) { tn.nodeValue = val; }
      else { el.textContent = val; }
    };
    const animate = (el: Element) => {
      const t = parseInt(el.getAttribute('data-count') || '0', 10); if (isNaN(t)) return;
      const s = performance.now();
      const step = (ts: number) => { const p = Math.min((ts - s) / 1800, 1); setVal(el, toFa(Math.floor((1 - Math.pow(1 - p, 3)) * t))); if (p < 1) requestAnimationFrame(step); else setVal(el, toFa(t)); };
      requestAnimationFrame(step);
    };
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { animate(e.target); obs.unobserve(e.target); } }), { threshold: .5 });
    document.querySelectorAll('[data-count]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  /* club visibility */
  useEffect(() => {
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { setClubVis(true); obs.unobserve(e.target); } }), { threshold: .3 });
    const el = document.querySelector('.club-grid'); if (el) obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const goto = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="sw-landing">
      <div className="sw-noise" />

      {/* ════════ NAV ════════ */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="ctr nav-inner">
          <div className="nav-logo" dir="ltr"><span className="dot" />Smart<b>Wash</b></div>
          <div className="nav-center">
            {[['امکانات','features'],['گالری','gallery'],['باشگاه','club'],['پلن‌ها','plans']].map(([l,id]) => (
              <a key={id} className="nav-link" href={`#${id}`} onClick={goto(id)}>
                {l}
              </a>
            ))}
            <Link to="/contact" className="nav-link">تماس</Link>
          </div>
          <div className="nav-actions">
            <Link to="/login" className="btn btn-outline">ورود</Link>
            <Link to="/register" className="btn btn-solid">شروع رایگان</Link>
          </div>
        </div>
      </nav>

      {/* ════════ HERO ════════ */}
      <section className="hero" id="hero">
        <div className="ctr">
          <div className="hero-grid">

            {/* ── Left: copy ── */}
            <div className="hero-copy">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                پلتفرم هوشمند کارواش — SmartWash
              </div>
              <h1 className="hero-title">
                <span className="ht-thin">کارواش خود را</span>
                <span className="ht-heavy">هوشمند<br />مدیریت کنید</span>
              </h1>
              <p className="hero-subtitle">
                داشبورد یکپارچه برای مدیریت جایگاه‌ها، مشتریان،<br />
                رزرو آنلاین و گزارش‌های مالی — برای کارواش‌های ایران.
              </p>
              <div className="hero-acts">
                <Link to="/register" className="btn btn-solid btn-lg btn-pill">شروع رایگان ۱۴ روزه</Link>
                <Link to="/contact" className="btn btn-outline btn-lg btn-pill">دمو رایگان</Link>
              </div>
              <div className="hero-proof">
                <div className="hero-proof-stat">
                  <span className="hero-proof-num">۲۵۰+</span>
                  <span className="hero-proof-lbl">کارواش فعال</span>
                </div>
                <div className="hero-proof-divider" />
                <div className="hero-proof-stat">
                  <span className="hero-proof-num">۱.۲M</span>
                  <span className="hero-proof-lbl">سفارش پردازش‌شده</span>
                </div>
                <div className="hero-proof-divider" />
                <div className="hero-proof-stat">
                  <span className="hero-proof-num">۹۸٪</span>
                  <span className="hero-proof-lbl">رضایت مشتریان</span>
                </div>
              </div>
            </div>

            {/* ── Right: visual ── */}
            <div className="hero-visual">
              {/* Card 1: top-left — درآمد */}
              <div className="gc gc-tl">
                <div className="gc-lbl" style={{ marginBottom: 4 }}>درآمد امروز</div>
                <div className="gc-val" data-count="13800000">۰</div>
                <div className="gc-trend">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7M17 7H7M17 7v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  ۱۸٪ از دیروز
                </div>
              </div>

              {/* Card 2: top-right — رضایت مشتریان */}
              <div className="gc gc-tr">
                <div className="gc-lbl" style={{ marginBottom: 4 }}>رضایت مشتریان</div>
                <div className="gc-val">۹۸٪</div>
                <div className="gc-trend">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.9 6.5L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.09-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
                  ۴.۸ / ۵
                </div>
              </div>

              {/* Card 3: bottom-left — مشتری VIP */}
              <div className="gc gc-bl" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="gc-avatar" style={{ background: '#E8262C' }}>ا.ک</div>
                <div>
                  <div className="gc-name">امیر کریمی</div>
                  <div className="gc-sub">VIP — ۲۲ مراجعه</div>
                </div>
              </div>

              {/* Card 4: bottom-right — vehicles (red) */}
              <div className="gc gc-br gc-red" style={{ padding: '12px 16px' }}>
                <div className="gc-ico-row">
                  <div className="gc-ico green">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <div className="gc-name">۴۷ خودرو</div>
                    <div className="gc-sub">پذیرش‌شده امروز</div>
                  </div>
                </div>
              </div>

              {/* Laptop + dashboard */}
              <div className="mac-wrap">
                {/* Real laptop photo with dashboard composited on screen */}
                <div className="lap">
                <img className="lap-photo" src={laptopPng} alt="SmartWash dashboard on laptop" loading="eager" draggable={false} />
                <div className="lap-screen">
                  <div className="ld">
                    <aside className="ld-side">
                      <div className="ld-logo"><span className="ld-logo-dot" />SmartWash</div>
                      {[
                        { l:'داشبورد', on:true }, { l:'مشتریان', on:false },
                        { l:'سفارش‌ها', on:false }, { l:'مالی', on:false }, { l:'گزارش', on:false },
                      ].map((item, i) => (
                        <div key={i} className={`ld-nav${item.on ? ' on' : ''}`}>
                          <span className="ld-nav-dot" />{item.l}
                        </div>
                      ))}
                    </aside>
                    <main className="ld-main">
                      <div className="ld-head">
                        <span className="ld-title">آنالیتیکس کارواش — شعبه مرکزی</span>
                        <span className="ld-live">زنده</span>
                      </div>
                      <div className="ld-kpis">
                        <div className="ld-kpi red">
                          <div className="ld-kpi-l">درآمد امروز</div>
                          <div className="ld-kpi-v" data-count="13800000">۰</div>
                          <div className="ld-kpi-t">↑ ۱۸٪ از دیروز</div>
                        </div>
                        <div className="ld-kpi soft">
                          <div className="ld-kpi-l">خودرو</div>
                          <div className="ld-kpi-v" data-count="47">۰</div>
                          <div className="ld-kpi-t">۶ در صف</div>
                        </div>
                        <div className="ld-kpi soft">
                          <div className="ld-kpi-l">بازگشتی</div>
                          <div className="ld-kpi-v" data-count="68">۰</div>
                          <div className="ld-kpi-t">٪</div>
                        </div>
                      </div>
                      <div className="ld-chart">
                        <svg viewBox="0 0 400 70" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="ldGrad" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#E8262C" stopOpacity=".18"/>
                              <stop offset="100%" stopColor="#E8262C" stopOpacity="0"/>
                            </linearGradient>
                          </defs>
                          <polyline className="ld-cfill" points="0,64 50,56 100,58 150,34 200,42 255,16 310,26 400,8 400,70 0,70"/>
                          <polyline className="ld-cline" points="0,64 50,56 100,58 150,34 200,42 255,16 310,26 400,8"/>
                        </svg>
                      </div>
                      <div className="ld-rows">
                        {[
                          { p:'IR ۲۷ - ج ۴۴۲', s:'دیتیلینگ', c:'act', l:'در حال انجام' },
                          { p:'IR ۱۳ - ب ۹۹۱', s:'شستشو',    c:'done', l:'تمام شد' },
                          { p:'IR ۴۴ - ل ۱۲۲', s:'واکس',     c:'rsv',  l:'رزرو ۱۴:۳۰' },
                        ].map((o, i) => (
                          <div key={i} className="ld-row">
                            <span className="ld-plate">{o.p}</span>
                            <span className="ld-svc">{o.s}</span>
                            <span className={`ld-tag ${o.c}`}>{o.l}</span>
                          </div>
                        ))}
                      </div>
                    </main>
                    <aside className="ld-queue">
                      <div className="ld-q-title">صف فعال</div>
                      {[
                        { n:'امیر ک.', s:'دیتیلینگ', a:'۲۸۰ت', c:'#E8262C' },
                        { n:'سارا م.', s:'شستشو',    a:'۱۲۰ت', c:'#7c3aed' },
                        { n:'رضا ت.', s:'واکس',      a:'۱۸۰ت', c:'#0891b2' },
                        { n:'مریم ب.', s:'دیتیلینگ', a:'۳۲۰ت', c:'#d97706' },
                      ].map((q, i) => (
                        <div key={i} className="ld-q-row">
                          <div className="ld-q-av" style={{ background: q.c }}>{q.n[0]}</div>
                          <div className="ld-q-info">
                            <div className="ld-q-name">{q.n}</div>
                            <div className="ld-q-svc">{q.s}</div>
                          </div>
                          <div className="ld-q-amt">{q.a}</div>
                        </div>
                      ))}
                    </aside>
                  </div>
                </div>
              </div>
              </div>{/* /mac-wrap */}
            </div>{/* /hero-visual */}
          </div>{/* /hero-grid */}
        </div>
      </section>


      {/* ════════ STATS ════════ */}
      <section className="stats-sec">
        <div className="ctr">
          <div className="stats-grid">
            {[
              { n:'250', s:'+', l:'کارواش فعال', hint:'در سراسر ایران', ico: Ico.dash },
              { n:'1200000', s:'', l:'سفارش پردازش‌شده', hint:'از ابتدا', ico: Ico.cal },
              { n:'98', s:'٪', l:'رضایت مشتریان', hint:'میانگین ۴.۸/۵', ico: Ico.star },
              { n:'24', s:'/7', l:'پشتیبانی فنی', hint:'پاسخگویی فارسی', ico: Ico.head },
            ].map((s, i) => (
              <div key={i} className="stat-box">
                <div className="stat-ico">{s.ico}</div>
                <div className="stat-num"><span data-count={s.n}>۰</span>{s.s}</div>
                <div className="stat-lbl">{s.l}</div>
                <div className="stat-hint">{s.hint}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ 01 FEATURES ════════ */}
      <section className="features-sec" id="features">
        <div className="ctr">
          <div className="nh">
            <div className="nh-left"><div className="nh-num">01</div><h2 className="nh-title">امکانات</h2></div>
            <div className="nh-right"><p>همه ابزارهای لازم برای اداره یک کارواش مدرن — در یک پنل یکپارچه.</p></div>
          </div>

          {/* Asymmetric bento: bc1 tall-red, bc5 wide, bc6 dark */}
          <div className="bento">
            {/* bc1: red tall (spans 2 rows) */}
            <div className="bcard bc-red bc1">
              <div className="bico">{Ico.dash}</div>
              <div className="btitle">داشبورد هوشمند</div>
              <div className="bdesc">نمای زنده از درآمد، ترافیک، جایگاه‌ها و عملکرد پرسنل — همه در یک صفحه و در لحظه.</div>
              <div className="btags"><span className="btag">زنده</span><span className="btag">چند شعبه</span></div>
              <div style={{ marginTop: 'auto', paddingTop: 20 }}>
                <svg viewBox="0 0 200 50" style={{ width: '100%', height: 50 }}>
                  <polyline points="0,42 30,36 60,38 90,22 120,28 155,10 200,14" style={{ fill: 'none', stroke: 'rgba(255,255,255,.5)', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
                </svg>
              </div>
            </div>

            {/* bc2 */}
            <div className="bcard bc2">
              <div className="bico">{Ico.crm}</div>
              <div className="btitle">CRM مشتریان</div>
              <div className="bdesc">سابقه کامل هر مشتری، یادآوری هوشمند و دسته‌بندی VIP.</div>
            </div>

            {/* bc3 */}
            <div className="bcard bc3">
              <div className="bico">{Ico.cal}</div>
              <div className="btitle">رزرو آنلاین</div>
              <div className="bdesc">مشتری از راه رزرو می‌کند، شما تقویم پر می‌بینید.</div>
            </div>

            {/* bc4 */}
            <div className="bcard bc4">
              <div className="bico">{Ico.fin}</div>
              <div className="btitle">مالی شفاف</div>
              <div className="bdesc">صندوق، انعام و سود خالص — هر تومان قابل ردیابی.</div>
            </div>

            {/* bc5: wide (spans 2 cols) */}
            <div className="bcard bc5">
              <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div className="bico">{Ico.staff}</div>
                <div style={{ flex: 1 }}>
                  <div className="btitle">عملکرد پرسنل</div>
                  <div className="bdesc">ارزیابی با عدد واقعی نه حدس — تعداد خودرو، رضایت مشتری، سهم انعام.</div>
                </div>
              </div>
              <div className="bcard-stats">
                <div className="bcs-item">
                  <div className="bcs-val" data-count="18">۰</div>
                  <div className="bcs-lbl">خودرو — رضایی</div>
                </div>
                <div className="bcs-item">
                  <div className="bcs-val" data-count="14">۰</div>
                  <div className="bcs-lbl">خودرو — حسینی</div>
                </div>
                <div className="bcs-item">
                  <div className="bcs-val">۴.۸</div>
                  <div className="bcs-lbl">میانگین رضایت</div>
                </div>
              </div>
              <div className="bcard-chart">
                <svg viewBox="0 0 400 52" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="bcGrad" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#E8262C" stopOpacity=".1"/>
                      <stop offset="100%" stopColor="#E8262C" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <polyline className="bc-cfill" points="0,46 60,38 120,42 180,24 240,30 300,12 400,8 400,52 0,52"/>
                  <polyline className="bc-cline" points="0,46 60,38 120,42 180,24 240,30 300,12 400,8"/>
                </svg>
              </div>
            </div>

            {/* bc6: dark */}
            <div className="bcard bc-dark bc6">
              <div className="bico">{Ico.star}</div>
              <div className="btitle">باشگاه مشتریان</div>
              <div className="bdesc">کیف پول، امتیاز وفاداری و اشتراک VIP — درآمد پایدار برای کارواش.</div>
              <div className="btags"><span className="btag">کیف پول</span><span className="btag">VIP</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ 02 GALLERY ════════ */}
      <section className="gallery-sec" id="gallery">
        <div className="ctr">
          <div className="nh">
            <div className="nh-left"><div className="nh-num">02</div><h2 className="nh-title">گالری</h2></div>
            <div className="nh-right"><p>تصاویر با کیفیت از ماشین‌های لوکس در حال دیتیلینگ — با افکت حرکتی.</p></div>
          </div>
          <div className="gal-scroll">
            {[
              { src: IMGS.ferrari, cap: 'Ferrari — دیتیلینگ اختصاصی' },
              { src: IMGS.wash,    cap: 'شستشوی حرفه‌ای' },
              { src: IMGS.microf,  cap: 'پولیش بدنه' },
              { src: IMGS.blue,    cap: 'سوپراسپرت' },
            ].map((img, i) => (
              <div key={i} className="gal-img">
                <img src={img.src} alt={img.cap} loading="lazy" />
                <div className="gal-overlay" />
                <div className="gal-caption">{img.cap}</div>
              </div>
            ))}
          </div>
          <div className="gal-nav">
            {[0, 1, 2, 3].map(i => (
              <button key={i} className={`gal-dot${galActive === i ? ' on' : ''}`} onClick={() => setGalActive(i)} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════ 03 TESTIMONIALS ════════ */}
      <section className="testi-sec" id="testimonials">
        <div className="ctr">
          <div className="nh">
            <div className="nh-left"><div className="nh-num">03</div><h2 className="nh-title">نظرات</h2></div>
            <div className="nh-right"><p>صدای مشتریان واقعی SmartWash — آواتارهای دایره‌ای و سایه‌های لایه‌ای.</p></div>
          </div>
          <div className="testi-grid">
            {testimonials.map((t, i) => (
              <div key={i} className="tcard">
                <div className="tcard-stars">{[...Array(5)].map((_, j) => <span key={j} className="tcard-star">★</span>)}</div>
                <p className="tcard-quote">«{t.text}»</p>
                <div className="tcard-foot">
                  <div className="tcard-av" style={{ background: t.color }}>{t.name.charAt(0)}</div>
                  <div>
                    <div className="tcard-name">{t.name}</div>
                    <div className="tcard-role">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ 04 BEFORE / AFTER ════════ */}
      <section className="cmp-sec" id="compare">
        <div className="ctr">
          <div className="nh">
            <div className="nh-left"><div className="nh-num">04</div><h2 className="nh-title">قبل و بعد</h2></div>
            <div className="nh-right"><p>خط را بکشید — تفاوت کارواش دیجیتال با مدیریت سنتی را احساس کنید.</p></div>
          </div>
          <div className="cmp-box">
            <div className="cb cb-tl" /><div className="cb cb-tr" />
            <div className="cb cb-bl" /><div className="cb cb-br" />
            <div className="cmp" ref={cmpRef}
              onMouseDown={e => startCmp(e.clientX)}
              onTouchStart={e => startCmp(e.touches[0].clientX)}>
              {/* After */}
              <div className="cmp-side cmp-after">
                <div className="cmp-lbl cl-after"><span className="cmp-led cl-g" />امروز با SmartWash</div>
                <div className="cmp-mock">
                  <div className="cm-top"><div className="cm-av" /><div className="cm-lb"><div className="cm-l w60" /><div className="cm-l w40" /></div></div>
                  <div className="cm-kpis">
                    <div className="cm-kpi"><div className="cm-kpi-l">درآمد</div><div className="cm-kpi-v" data-count="13800000">۰</div></div>
                    <div className="cm-kpi"><div className="cm-kpi-l">خودرو</div><div className="cm-kpi-v" data-count="47">۰</div></div>
                    <div className="cm-kpi up"><div className="cm-kpi-l">بازگشتی</div><div className="cm-kpi-v" data-count="68">۰</div></div>
                  </div>
                  <div className="cm-chart"><svg viewBox="0 0 240 32" preserveAspectRatio="none"><polyline className="cm-cl" points="0,28 30,22 65,24 100,12 135,16 175,4 240,6"/><polyline className="cm-cf" points="0,28 30,22 65,24 100,12 135,16 175,4 240,6 240,32 0,32"/></svg></div>
                  <div className="cm-pills">
                    <div className="cm-pill"><span className="cm-pill-dot" />جایگاه ۱</div>
                    <div className="cm-pill"><span className="cm-pill-dot" />جایگاه ۲</div>
                  </div>
                </div>
              </div>
              {/* Before */}
              <div className="cmp-side cmp-before" style={{ clipPath: `inset(0 0 0 ${cmpPos}%)` }}>
                <div className="cmp-lbl cl-before"><span className="cmp-led cl-r" />بدون سیستم</div>
                <div className="cmp-paper">
                  <div className="cp-l" /><div className="cp-l sc" /><div className="cp-l s" />
                  <div className="cp-l" /><div className="cp-blot" /><div className="cp-l sc" />
                  <div className="cp-q">مشتری بازگشتی همین ماه؟</div>
                  <div className="cp-qm">؟</div><div className="cp-l" />
                </div>
              </div>
              {/* Handle */}
              <div className="cmp-handle" style={{ right: `${100 - cmpPos}%`, transform: 'translateX(50%)' }}>
                <div className="cmp-grip">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6L3 12L9 18M15 6L21 12L15 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
              <div className={`cmp-hint${hintOff ? ' hidden' : ''}`}>خط را بکشید</div>
            </div>
            {/* Labels */}
            <div className="cmp-labels">
              <div className="cmp-label-item after"><span className="cmp-label-dot g" />SmartWash: گزارش زنده، مشتری وفادار، درآمد پایدار</div>
              <div className="cmp-label-item before"><span className="cmp-label-dot r" />بدون سیستم: دفتر کاغذی، آمار ناقص، مشتری فراموش‌شده</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ 05 CLUB ════════ */}
      <section className="club-sec" id="club">
        <div className="ctr">
          <div className="nh">
            <div className="nh-left"><div className="nh-num">05</div><h2 className="nh-title">باشگاه</h2></div>
            <div className="nh-right"><p>مشتری که برمی‌گردد، درآمدی است که تضمین شده.</p></div>
          </div>
          <div className="club-grid">
            <div className="club-card">
              <div className="cc-head"><div className="cc-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7"/><path d="M2 10h20M16 15h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg></div><h3>کیف پول</h3></div>
              <p>شارژ اعتبار، بازگشت خودکار. مشتری پول را نگه می‌دارد نه خرج می‌کند.</p>
              <div className="w-vis">
                <div className="w-bal"><span>موجودی</span><b data-count="2450000">۰</b><small>تومان</small></div>
                <div className="w-bg"><div className={`w-fill${clubVis ? ' on' : ''}`} /></div>
              </div>
            </div>
            <div className="club-card">
              <div className="cc-head"><div className="cc-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.9 6.5L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.09-1.01L12 2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg></div><h3>امتیاز وفاداری</h3></div>
              <p>هر مراجعه امتیاز می‌سازد. امتیاز تخفیف می‌سازد. یک چرخه پایدار.</p>
              <div className="ly-vis">
                <svg viewBox="0 0 120 120" className="ly-svg">
                  <circle cx="60" cy="60" r="50" stroke="rgba(0,0,0,.06)" strokeWidth="9" fill="none"/>
                  <circle cx="60" cy="60" r="50" stroke="#E8262C" strokeWidth="9" fill="none" strokeDasharray="314" strokeDashoffset={clubVis ? 88 : 314} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1.6s cubic-bezier(.22,1,.36,1)' }}/>
                </svg>
                <div className="ly-ctr"><b>۷۲۰</b><span>امتیاز</span></div>
              </div>
            </div>
            <div className="club-card">
              <div className="cc-head"><div className="cc-ico gold"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 19h14M5 19l1.5-9L9 14l3-7 3 7 2.5-4L19 19" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/></svg></div><h3>اشتراک VIP</h3></div>
              <p>درآمد ماهانه پایدار برای کارواش، خدمات بی‌دغدغه برای مشتری.</p>
              <div className="vip-rows">
                <div className="vip-row"><span>شستشو ماهانه</span><b>۱۰ بار</b></div>
                <div className="vip-row"><span>واکس رایگان</span><b>۲ بار</b></div>
                <div className="vip-row hi"><span>صرفه‌جویی سالانه</span><b>۲۲٪</b></div>
              </div>
            </div>
            <div className="club-card">
              <div className="cc-head"><div className="cc-ico"><svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></div><h3>رزرو آنلاین</h3></div>
              <p>بدون صف، بدون سردرگمی. تقویم همیشه به‌روز است.</p>
              <div className="bk-slots">
                {[{t:'۹:۰۰',d:true},{t:'۱۰:۰۰',d:true},{t:'۱۱:۳۰',a:true},{t:'۱۳:۰۰'},{t:'۱۵:۳۰'},{t:'۱۷:۰۰',d:true}].map((s, i) => (
                  <button key={i} className={`bk-s${s.d ? ' d' : s.a ? ' a' : ''}`}>{s.t}</button>
                ))}
              </div>
            </div>
          </div>
          {/* Club banner */}
          <div className="club-banner">
            <div className="cb-txt">
              <h4>نمونه واقعی یک عضو VIP طلایی</h4>
              <p>مشتری با پرداخت سالانه خدمات متنوع دریافت می‌کند — کارواش از روز اول درآمد تضمین‌شده دارد.</p>
            </div>
            <div className="cb-card">
              <div className="cbc-badge">عضویت طلایی SmartWash</div>
              <div className="cbc-amount">۲٬۴۰۰٬۰۰۰ <small>تومان / سال</small></div>
              <div className="cbc-perks">
                <div className="cbc-perk">۱۰ شستشوی کامل ماهانه</div>
                <div className="cbc-perk">۲ واکس رایگان در سال</div>
                <div className="cbc-perk">۱۵٪ تخفیف دیتیلینگ</div>
              </div>
              <div className="cbc-meta">معتبر تا ۱۲/۱۴۰۵ — MEM# SW-2291</div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ 06 PLANS ════════ */}
      <section className="plans-sec" id="plans">
        <div className="ctr">
          <div className="nh">
            <div className="nh-left"><div className="nh-num">06</div><h2 className="nh-title">پلن‌ها</h2></div>
            <div className="nh-right"><p>از کارواش تازه‌دیجیتال‌شده تا زنجیره‌های بزرگ.</p></div>
          </div>
          <div className="plan-cycle" role="group" aria-label="دوره پرداخت">
            <button onClick={() => setPlanCycle('monthly')} className={planCycle === 'monthly' ? 'active' : ''}>ماهانه</button>
            <button onClick={() => setPlanCycle('yearly')} className={planCycle === 'yearly' ? 'active' : ''}>سالانه</button>
          </div>
          <div className="plans-grid">
            {publicPlans.map((plan, index) => {
              const annual = planCycle === 'yearly';
              const price = annual ? plan.yearlyPriceRials : plan.monthlyPriceRials;
              const featured = index === 1;
              return <div key={plan.id} className={`plan-card${featured ? ' featured' : ''}`}>
                {featured && <span className="plan-tag">پیشنهادی</span>}
                <div className="plan-tier-chip">{plan.code}</div>
                <span className="plan-name">{plan.displayName}</span>
                <p className="plan-desc">{plan.description || 'تعرفه و امکانات این پلن از پنل مدیریت به‌روز می‌شود.'}</p>
                <div className="plan-price-blk">
                  {plan.setupFeeRials > 0 && <div className="plan-price"><b>{toman(plan.setupFeeRials)}</b><span>تومان راه‌اندازی</span></div>}
                  <div className="plan-monthly">{price > 0 ? `${toman(price)} تومان / ${annual ? 'سال' : 'ماه'}` : 'تماس بگیرید'}</div>
                </div>
                <ul className="plan-list">{visiblePlanFeatureLabels(plan.features).map(label => <li key={label}>{label}</li>)}</ul>
                <Link to={`/register?planId=${plan.id}&cycle=${annual ? 1 : 0}`} className={`btn ${featured ? 'btn-solid' : 'btn-ghost'} plan-btn`}>انتخاب این پلن</Link>
              </div>;
            })}
          </div>
          {/* Modules */}
          <div className="modules-strip">
            <p className="mods-label">ماژول‌های قابل افزودن به هر پلن</p>
            <div className="mods-row">
              {['CRM پیشرفته','باشگاه مشتریان','کیف پول دیجیتال','رزرو آنلاین','مدیریت انعام','حسابداری حرفه‌ای','اپلیکیشن اختصاصی'].map(m => (
                <span key={m} className="mod-chip">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════ TRUST ════════ */}
      <section className="trust-sec">
        <div className="ctr">
          <div className="trust-grid">
            {[
              { ico: Ico.shield,  t:'امنیت بانکی',       d:'رمزنگاری کامل، نسخه‌گیری روزانه' },
              { ico: Ico.zap,     t:'سرعت در ایران',     d:'سرورهای داخلی، تأخیر ناچیز' },
              { ico: Ico.head,    t:'پشتیبانی ۲۴/۷',    d:'چت، تلگرام و تلفن فارسی' },
              { ico: Ico.mac,     t:'بدون نصب',          d:'فقط مرورگر، روی هر دستگاه' },
            ].map((item, i) => (
              <div key={i} className="trust-item">
                <div className="trust-ico">{item.ico}</div>
                <div>
                  <div className="trust-title">{item.t}</div>
                  <div className="trust-desc">{item.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ CTA ════════ */}
      <section className="cta-sec" id="cta">
        <div className="ctr">
          <div className="cta-box">
            <div className="cta-img" /><div className="cta-ov" /><div className="cta-dots" />
            <div className="cta-inner">
              <div className="cta-eyebrow">قدم بعدی</div>
              <h2 className="cta-title">
                از یک محل شستشو<br />
                به یک <span className="hi">برند</span> خدمات خودرویی مدرن
              </h2>
              <p className="cta-sub">
                دموی رایگان را رزرو کنید — در ۱۵ دقیقه ببینید کارواش‌تان روی SmartWash چطور دیجیتال می‌شود.
              </p>
              <div className="cta-btns">
                <Link to="/contact" className="btn btn-solid btn-lg btn-pill">
                  {Ico.phone} رزرو دمو رایگان
                </Link>
                <Link to="/register" className="btn btn-dark-ghost btn-lg btn-pill">
                  {Ico.play} شروع رایگان
                </Link>
              </div>
              <div className="cta-proof">
                <div style={{ textAlign: 'center' }}><div className="cp-val">۱۴</div><div className="cp-lbl">روز آزمایش رایگان</div></div>
                <div className="cp-div" />
                <div style={{ textAlign: 'center' }}><div className="cp-val">۲۵۰+</div><div className="cp-lbl">کارواش فعال</div></div>
                <div className="cp-div" />
                <div style={{ textAlign: 'center' }}><div className="cp-val">۱۵ دقیقه</div><div className="cp-lbl">راه‌اندازی اولیه</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ FOOTER ════════ */}
      <footer className="footer">
        <div className="ctr">
          <div className="footer-grid">
            <div>
              <div className="ftr-logo" dir="ltr"><span className="dot" />Smart<b>Wash</b></div>
              <p className="ftr-desc">پلتفرم مدیریت و باشگاه مشتریان کارواش — از مدیریت روزانه تا برندسازی حرفه‌ای.</p>
              <div className="ftr-social">
                <a href="#" className="ftr-soc" aria-label="تلگرام">{Ico.tg}</a>
                <a href="#" className="ftr-soc" aria-label="اینستاگرام">{Ico.ig}</a>
                <a href="tel:09000000000" className="ftr-soc" aria-label="تلفن">{Ico.phone}</a>
              </div>
            </div>
            <div className="ftr-col">
              <div className="ftr-col-ttl">پلتفرم</div>
              <a href="#features" onClick={goto('features')}>امکانات</a>
              <a href="#gallery"  onClick={goto('gallery')}>گالری</a>
              <a href="#club"     onClick={goto('club')}>باشگاه مشتریان</a>
              <a href="#plans"    onClick={goto('plans')}>پلن‌ها</a>
            </div>
            <div className="ftr-col">
              <div className="ftr-col-ttl">دسترسی</div>
              <Link to="/login">ورود به پنل</Link>
              <Link to="/register">ثبت‌نام رایگان</Link>
              <Link to="/pricing">تعرفه‌ها</Link>
              <Link to="/contact">تماس با ما</Link>
            </div>
            <div className="ftr-col">
              <div className="ftr-col-ttl">تماس</div>
              <a href="tel:09000000000">۰۹۰۰ ۰۰۰ ۰۰۰۰</a>
              <a href="mailto:info@smartwash.ir">info@smartwash.ir</a>
              <span>تهران، ایران</span>
              <span>appsmartwash.com</span>
            </div>
          </div>
          <div className="ftr-bottom">
            <div className="ftr-copy">© ۱۴۰۴ SmartWash. تمامی حقوق محفوظ است.</div>
            <div className="ftr-badges">
              <div className="ftr-badge">{Ico.ssl} سرور ایران</div>
              <div className="ftr-badge">{Ico.check} SSL رمزنگاری</div>
              <div className="ftr-badge">{Ico.star} ۹۸٪ رضایت</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
