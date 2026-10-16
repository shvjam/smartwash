import React, { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Quote, ChevronRight, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { Container, Reveal, SectionHead, fa } from '../../../components/landing/kit';

/**
 * What other owners say, in their own operational language.
 *
 * Testimonials are only worth the floor they describe, so each one names a thing that changed
 * on the floor — a queue that stopped forming, a shift that balanced, an empty Tuesday that
 * filled — rather than praising the software in general.
 *
 * It is a carousel because these are peers to browse, not a ranking to read in order.
 */

const VOICES = [
  {
    name: 'علی محمدی', role: 'کارواش پارس، تهران', mark: 'ع', tone: 'bg-brand-100 text-brand-700',
    text: 'قبلاً سر ساعت شش عصر سه تا ماشین تو حیاط منتظر بودن و کسی نمی‌دونست کدوم زودتر اومده. الان صف شماره داره و خودش جلو می‌ره. ماهی حدود سی تا ماشین بیشتر می‌شوریم.',
    stat: '+۳۰ خودرو در ماه',
  },
  {
    name: 'سارا کریمی', role: 'کارواش نیاوران', mark: 'س', tone: 'bg-violet-100 text-violet-700',
    text: 'یادآور خدمت بهترین بخشش بود. مشتری‌هایی که شش ماه ندیده بودیم با یه پیامک برگشتن. سه‌شنبه‌ها که همیشه خالی بود حالا پره.',
    stat: 'سه‌شنبه‌های خالی پر شد',
  },
  {
    name: 'رضا سلیمانی', role: 'زنجیره‌ی چهار شعبه‌ای', mark: 'ر', tone: 'bg-sky-100 text-sky-700',
    text: 'من دیگه برای بستن صندوق شعبه‌ها نمی‌رم اونجا. گزارش هر شعبه و تسویه‌ی انعام بچه‌ها رو از گوشی می‌بینم و تأیید می‌کنم.',
    stat: 'چهار شعبه از یک گوشی',
  },
  {
    name: 'مهدی زارعی', role: 'کارواش اتوبان، کرج', mark: 'م', tone: 'bg-emerald-100 text-emerald-700',
    text: 'قانون «تحویل بدون تسویه ممنوع» عملاً مشکل بدهی‌های فراموش‌شده رو تموم کرد. آخر ماه دیگه دنبال کسی نیستیم.',
    stat: 'بدهی معوق: صفر',
  },
];

export const Voices = () => {
  const [ref, embla] = useEmblaCarousel({ direction: 'rtl', align: 'start', loop: true, skipSnaps: false });
  const [at, setAt] = useState(0);

  const onSelect = useCallback(() => embla && setAt(embla.selectedScrollSnap()), [embla]);
  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on('select', onSelect);
    const timer = window.setInterval(() => embla.scrollNext(), 5200);
    return () => { embla.off('select', onSelect); window.clearInterval(timer); };
  }, [embla, onSelect]);

  return (
    <section className="sw-band sw-band-brand relative py-20 md:py-28" id="voices">
      <Container>
        <SectionHead
          eyebrow="تجربه‌ها"
          tone="violet"
          title="کسانی که هر روز با آن کار می‌کنند"
          lead="هیچ‌کدام درباره‌ی نرم‌افزار حرف نزده‌اند؛ درباره‌ی چیزی گفته‌اند که در کارواششان عوض شد."
        />

        <Reveal>
          <div className="relative">
            <div className="overflow-hidden" ref={ref}>
              <div className="flex gap-4 pb-2">
                {VOICES.map(v => (
                  <figure key={v.name} className="sw-voice">
                    <Quote size={22} className="text-brand-200" />
                    <blockquote className="mt-3 flex-1 text-[13.5px] leading-8 text-slate-700">{v.text}</blockquote>
                    <span className="mt-4 inline-flex w-fit rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-extrabold text-slate-600">{v.stat}</span>
                    <figcaption className="mt-4 flex items-center gap-2.5 border-t border-slate-100 pt-4">
                      <span className={clsx('grid size-9 place-items-center rounded-xl text-sm font-black', v.tone)}>{v.mark}</span>
                      <span>
                        <span className="block text-[12.5px] font-extrabold text-slate-900">{v.name}</span>
                        <span className="block text-[11px] text-slate-400">{v.role}</span>
                      </span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button type="button" onClick={() => embla?.scrollPrev()} className="sw-carousel-btn" aria-label="قبلی">
                <ChevronRight size={16} />
              </button>
              <div className="flex gap-1.5">
                {VOICES.map((v, i) => (
                  <button
                    key={v.name} type="button" onClick={() => embla?.scrollTo(i)}
                    aria-label={`نظر ${fa(i + 1)}`}
                    className={clsx('h-1.5 rounded-full transition-all', i === at ? 'w-6 bg-brand-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400')}
                  />
                ))}
              </div>
              <button type="button" onClick={() => embla?.scrollNext()} className="sw-carousel-btn" aria-label="بعدی">
                <ChevronLeft size={16} />
              </button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
};
