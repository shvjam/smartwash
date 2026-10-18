import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { normalizeDigits } from '../../../lib/persian';
import { Btn, Particles, Roll, Split, Stroke, View, WaveField, useIsDesktop, useLenis, useStart } from './kit';
import { LoyaltyScreen, PhoneFrame } from './mockups';

/* ── the name, drifting across a moving glow ──────────────────────────────── */

export const NameMarquee = () => (
  <section className="swl-name" aria-label="SmartWash">
    <div className="swl-name-bg" aria-hidden="true">
      <div className="absolute inset-0 opacity-80"><WaveField lines={46} intensity={0.85} /></div>
      <div className="swl-name-blob" style={{ width: '46rem', height: '30rem', left: '8%', top: '18%', background: '#b91c1c', opacity: 0.55, animation: 'swl-blob-a 18s ease-in-out infinite' }} />
      <div className="swl-name-blob" style={{ width: '38rem', height: '26rem', right: '6%', top: '30%', background: '#ff6b4a', opacity: 0.35, animation: 'swl-blob-b 22s ease-in-out infinite' }} />
      <div className="swl-name-blob" style={{ width: '30rem', height: '22rem', left: '40%', bottom: '8%', background: '#4c0519', opacity: 0.8, animation: 'swl-blob-a 26s ease-in-out infinite reverse' }} />
      <div className="swl-name-mask" />
    </div>
    <Split as="p" text="ابزار مدیریت کارواش، از پذیرش تا تحویل" preset="down"
      className="swl-mid absolute inset-x-0 top-[14%] z-10 text-center" />
    {/* Left-anchored: in the page's RTL flow the wide track hung off the right edge and was
        scrolled out of view for most of the loop. */}
    <div className="relative z-10" dir="ltr" aria-hidden="true">
      <div className="swl-name-track">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="swl-name-word swl-latin">
            {i === 0 ? <Split text="smartwash" chars preset="right" /> : 'smartwash'}
          </span>
        ))}
      </div>
    </div>
  </section>
);

/* ── closing call to action ───────────────────────────────────────────────── */

export const Cta = () => {
  const start = useStart();
  const desktop = useIsDesktop();
  return (
    <section className="relative z-10" aria-labelledby="swl-cta-title">
      <div className="swl-container pb-20 lg:pb-[10rem]">
        <View>
          <Stroke className="swl-cta-stroke">
            <div className="swl-cta-card" style={{ backgroundImage: 'radial-gradient(60% 90% at 25% 100%, rgba(220,38,38,.32), transparent 70%)' }}>
              <div className="absolute inset-0 opacity-70" aria-hidden="true"><WaveField lines={30} intensity={0.7} /></div>
              <div className="relative z-[2] flex flex-col items-center lg:items-start">
                <h2 id="swl-cta-title" className="swl-h1">
                  <Split text="کارواش منظم،" preset="down" /><br />
                  <Split text="از همین امروز" preset="down" delay={0.2} />
                </h2>
                <Split as="p" text="چهارده روز همه‌ی امکانات، بدون کارت بانکی و بدون نصب برنامه؛ روی رایانه‌ی پذیرش، تبلت یا گوشی." preset="down"
                  className="swl-body swl-dim block max-w-[22rem] pb-8 pt-5 lg:max-w-[24rem]" delay={0.3} stagger={0.03} />
                <div className="flex flex-wrap justify-center gap-3">
                  <Btn onClick={start}>شروع رایگان</Btn>
                  <Btn variant="ghost" to="/contact">گفتگو با ما</Btn>
                </div>
              </div>
              <View from="down" className={desktop ? 'absolute bottom-[-15rem] left-[13%] z-[3]' : 'relative mx-auto mt-12 -mb-44 h-[24rem]'} >
                <div aria-hidden="true">
                  <PhoneFrame style={{ fontSize: desktop ? '1.02rem' : '.9rem', transform: desktop ? 'perspective(2200px) rotateX(10deg) rotateY(-12deg) rotateZ(10deg)' : 'rotateZ(-4deg)' }}>
                    <LoyaltyScreen />
                  </PhoneFrame>
                </div>
              </View>
              <Particles density={0.5} />
            </div>
          </Stroke>
        </View>
      </div>
    </section>
  );
};

/* ── footer ───────────────────────────────────────────────────────────────── */

const FOOTER_LINKS = [
  { to: '/features', label: 'امکانات' },
  { to: '/pricing', label: 'تعرفه‌ها' },
  { to: '/contact', label: 'تماس با ما' },
  { to: '/register', label: 'ثبت‌نام' },
  { to: '/login', label: 'ورود به پنل' },
];

export const Footer = () => {
  const start = useStart();
  return (
    <footer className="swl-footer">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true"
        style={{ backgroundImage: 'radial-gradient(50% 60% at 50% 115%, rgba(220,38,38,.45), transparent 70%), radial-gradient(30% 40% at 85% 100%, rgba(255,107,94,.18), transparent 70%)' }} />
      <div className="swl-container relative pt-16 lg:px-[4.2rem] lg:pt-[4rem]">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-4">
            <p className="swl-body swl-dim">کارواش منظم، مشتری‌ای که برمی‌گردد</p>
            <a href="mailto:info@appsmartwash.com" className="swl-footer-mail swl-latin swl-roll-host self-start"><Roll text="info@appsmartwash.com" /></a>
          </div>
          <div className="flex flex-col gap-[1.4rem] lg:items-end lg:text-left">
            <div>
              <div className="swl-mid font-semibold">۱۴ روز رایگان امتحان کنید</div>
              <div className="swl-body swl-dim">بدون کارت بانکی، بدون قرارداد</div>
            </div>
            <Btn onClick={start} className="self-start lg:self-end">شروع رایگان</Btn>
          </div>
        </div>
        <nav className="swl-footer-links mt-12 lg:mt-[4rem]" aria-label="پیوندهای پایانی">
          {FOOTER_LINKS.map(l => (
            <Link key={l.to} to={l.to} className="swl-footer-link swl-roll-host"><Roll text={l.label} /></Link>
          ))}
        </nav>
        <div className="flex flex-col gap-6 pb-8 pt-10 lg:gap-[2.4rem] lg:pt-[3rem]">
          <div className="swl-footer-name swl-latin" aria-hidden="true">SMARTWASH</div>
          <div className="flex flex-col items-center justify-between gap-3 text-[max(.9rem,13px)] text-white/55 sm:flex-row">
            <span>© {new Date().toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric' })} SmartWash · سامانه‌ی مدیریت کارواش</span>
            <span>میزبانی‌شده در ایران · مبالغ به تومان</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* ── quick start: the reference's waitlist pop-up, wired to real sign-up ──── */

const PHONE_RE = /^09\d{9}$/;

export const QuickStart = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const lenis = useLenis();
  const first = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) lenis.current?.stop(); else lenis.current?.start();
    document.documentElement.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const id = window.setTimeout(() => first.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.clearTimeout(id); window.removeEventListener('keydown', onKey); };
  }, [open, onClose, lenis]);

  const cleanPhone = normalizeDigits(phone).replace(/[\s-]/g, '');
  const nameError = tried && !name.trim();
  const phoneError = tried && !PHONE_RE.test(cleanPhone);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!name.trim() || !PHONE_RE.test(cleanPhone)) return;
    onClose();
    navigate(`/register?name=${encodeURIComponent(name.trim())}&phone=${encodeURIComponent(cleanPhone)}`);
  };

  const ease = [0.19, 1, 0.22, 1] as const;
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="swl-pop" role="dialog" aria-modal="true" aria-labelledby="swl-pop-title"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.35, delay: 0.2 } }} transition={{ duration: 0.2 }}>
          <button type="button" className="absolute inset-0 cursor-default" aria-label="بستن" tabIndex={-1} onClick={onClose} />
          {[48, 72, 96].map((w, i) => (
            <motion.div key={w} className="swl-pop-ellipse pointer-events-none" style={{ width: `${w}rem`, x: '-50%', y: '-50%' }}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ duration: 2, delay: 0.6 - i * 0.2, ease }} aria-hidden="true" />
          ))}
          <div className="swl-pop-blur" aria-hidden="true" />
          <Particles density={0.6} />
          <motion.div className="relative z-10" style={{ transformOrigin: '50% 100%' }}
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ scale: { duration: 2, ease }, opacity: { duration: 0.4 } }}>
            <Stroke className="swl-pop-card" style={{ borderRadius: '1.68rem' }}>
              <form onSubmit={submit} noValidate>
                <h2 id="swl-pop-title" className="swl-h3 leading-tight">شروع کنید<br /><span className="text-[#f87171]">همین امروز</span></h2>
                <p className="swl-body swl-dim mt-2">نام کارواش و شماره‌ی موبایلتان را بنویسید؛ بقیه‌ی ثبت‌نام را در صفحه‌ی بعد کامل می‌کنید.</p>
                <div className="flex flex-col gap-3 pb-6 pt-5">
                  <label className="block">
                    <span className="sr-only">نام کارواش</span>
                    <input ref={first} className="swl-input" placeholder="نام کارواش" value={name} maxLength={120}
                      onChange={e => setName(e.target.value)} aria-invalid={nameError} aria-describedby={nameError ? 'swl-err-name' : undefined} />
                    {nameError && <span id="swl-err-name" className="mt-1.5 block text-[13px] text-[#f87171]">نام کارواش را بنویسید.</span>}
                  </label>
                  <label className="block">
                    <span className="sr-only">شماره‌ی موبایل</span>
                    <input className="swl-input" placeholder="شماره‌ی موبایل، مثل ۰۹۱۲۱۲۳۴۵۶۷" inputMode="tel" autoComplete="tel" dir="rtl" value={phone}
                      onChange={e => setPhone(e.target.value)} aria-invalid={phoneError} aria-describedby={phoneError ? 'swl-err-phone' : undefined} />
                    {phoneError && <span id="swl-err-phone" className="mt-1.5 block text-[13px] text-[#f87171]">شماره‌ی موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد.</span>}
                  </label>
                </div>
                <Btn type="submit" className="w-full">ادامه‌ی ثبت‌نام</Btn>
                <p className="mt-4 text-center text-[13px] text-white/45">۱۴ روز رایگان · بدون کارت بانکی</p>
              </form>
            </Stroke>
          </motion.div>
          <motion.div className="relative z-10" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ scale: { duration: 2, ease }, opacity: { duration: 0.4 } }}>
            <Btn variant="ghost" onClick={onClose}>بستن</Btn>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
