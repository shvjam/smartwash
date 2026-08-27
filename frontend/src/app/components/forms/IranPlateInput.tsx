import React, { useEffect, useRef, useState } from 'react';
import { normalizeDigits } from '../../lib/persian';

/**
 * پلاک خودروی ایران — چیدمان فیزیکی از چپ به راست:
 *   [نوار آبی I.R.IRAN] [۲ رقم] [حرف] [۳ رقم] │ [۲ رقم کد استان]
 *
 * طراحی از صفر، ساده و بدون حلقه‌ی round-trip:
 *  - «منبع حقیقت» چهار بخشِ مجزا در state است (first/letter/middle/code).
 *  - هر کادرِ عددی مستقل است؛ onChange کلِ محتوای همان کادر را می‌گیرد، فقط
 *    رقم‌های لاتین را نگه می‌دارد و روی سقفِ ثابت (۲/۳/۲) برش می‌زند.
 *  - داخل کادرهای قابل‌تایپ عمداً ارقام لاتین نمایش داده می‌شوند؛ تبدیلِ لحظه‌ایِ
 *    لاتین↔فارسی داخل یک input کنترل‌شده روی iOS Safari باعث افتادنِ رقم‌های بعدی
 *    می‌شود. نمایشِ فارسی فقط در حالتِ فقط‌خواندنی (formatIranPlate) انجام می‌شود.
 *  - قالب خروجی همیشه لاتین و شاملِ حرف و «ایران» است: «12 ب 345 ایران 77».
 */

/** حروف مجاز پلاک‌های ایران (شخصی، دولتی، تاکسی، معلولین و تشریفات). */
export const IRAN_PLATE_LETTERS = [
  'الف', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'ژ',
  'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ک', 'گ', 'ل', 'م',
  'ن', 'و', 'ه', 'ی', 'معلولین', 'تشریفات',
] as const;

/** حرف پیش‌فرضِ پلاک هنگام باز شدن فرم. */
export const DEFAULT_PLATE_LETTER = 'الف';

/** طولِ ثابتِ هر بخشِ عددی. */
const LEN = { first: 2, middle: 3, code: 2 } as const;

type Parts = { first: string; letter: string; middle: string; code: string };

const toFa = (v: string) => v.replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
/** فقط رقم‌های لاتین را برمی‌گرداند (فارسی/عربی هم لاتین می‌شوند). */
const toEnDigits = (v: string) => normalizeDigits(String(v)).replace(/\D/g, '');

/** یکسان‌سازی حروف عربی/فارسی تا «كاف» و «يـ» عربی هم درست تشخیص داده شوند. */
const canonicalLetters = (v: string) =>
  v.replace(/ك/g, 'ک').replace(/[يى]/g, 'ی').replace(/ة/g, 'ه');

/**
 * تجزیه‌ی قطعی و تحمل‌پذیر. هر رشته‌ای را می‌پذیرد — با/بدون فاصله، با/بدون «ایران»،
 * ارقام فارسی/عربی/لاتین، و پلاک نیمه‌کامل. هرگز throw نمی‌کند.
 *
 * منطق: «ایران» بدنه را از کد استان جدا می‌کند؛ حرف، دو‌رقمیِ اول را از سه‌رقمی.
 * حرف فقط داخل بدنه (چپِ «ایران») جست‌وجو می‌شود تا حرف «ی»ِ خودِ «ایران» گرفته نشود.
 */
export function parseIranPlate(value: string): Parts {
  const empty: Parts = { first: '', letter: '', middle: '', code: '' };
  if (!value) return empty;

  const norm = canonicalLetters(normalizeDigits(String(value)));
  const dividerAt = norm.search(/ایران|iran/i);
  const hasDivider = dividerAt !== -1;

  const body = hasDivider ? norm.slice(0, dividerAt) : norm;
  const codePart = hasDivider ? norm.slice(dividerAt).replace(/ایران|iran/gi, ' ') : '';
  const onlyDigits = (s: string) => (s.match(/\d+/g) ?? []).join('');
  const dividerCode = onlyDigits(codePart).slice(0, LEN.code);

  let letter = '';
  let letterAt = -1;
  for (const candidate of [...IRAN_PLATE_LETTERS].sort((a, b) => b.length - a.length)) {
    const at = body.indexOf(candidate);
    if (at !== -1) { letter = candidate; letterAt = at; break; }
  }

  if (letterAt !== -1) {
    const first = onlyDigits(body.slice(0, letterAt)).slice(0, LEN.first);
    const rest = onlyDigits(body.slice(letterAt + letter.length));
    return {
      first,
      letter,
      middle: rest.slice(0, LEN.middle),
      code: hasDivider ? dividerCode : rest.slice(LEN.middle, LEN.middle + LEN.code),
    };
  }

  const flat = onlyDigits(body);
  return {
    first: flat.slice(0, LEN.first),
    letter: '',
    middle: flat.slice(LEN.first, LEN.first + LEN.middle),
    code: hasDivider ? dividerCode : flat.slice(LEN.first + LEN.middle, LEN.first + LEN.middle + LEN.code),
  };
}

/** قالب قطعی برای API — ارقام لاتین. پلاکِ بدونِ هیچ رقمی، خالی محسوب می‌شود. */
export function serializeIranPlate(p: Parts): string {
  if (!p.first && !p.middle && !p.code) return '';
  const letter = p.letter || DEFAULT_PLATE_LETTER;
  return `${p.first} ${letter} ${p.middle} ایران ${p.code}`.replace(/\s+/g, ' ').trim();
}

export function normalizeIranPlate(value: string): string {
  return serializeIranPlate(parseIranPlate(value));
}

/** برای نمایش در جدول‌ها و کارت‌ها — ارقام فارسی و فاصله‌گذاری یکسان. */
export function formatIranPlate(value: string): string {
  if (!isIranPlateComplete(value)) return value ? toFa(normalizeDigits(value)) : '';
  const p = parseIranPlate(value);
  return `${toFa(p.first)} ${p.letter} ${toFa(p.middle)} ایران ${toFa(p.code)}`;
}

export function isIranPlateComplete(value: string): boolean {
  const p = parseIranPlate(value);
  return p.first.length === LEN.first && !!p.letter && p.middle.length === LEN.middle && p.code.length === LEN.code;
}

type Box = 'first' | 'middle' | 'code';

export const IranPlateInput = ({
  value, onChange, required = false, disabled = false, className = '', autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}) => {
  const load = (v: string): Parts => {
    const p = parseIranPlate(v);
    return { ...p, letter: p.letter || DEFAULT_PLATE_LETTER };
  };

  const [parts, setParts] = useState<Parts>(() => load(value));
  // «آخرین مقداری که خودمان به بالا دادیم». چون والد آن را دست‌نخورده برمی‌گرداند،
  // با همین مقایسه‌ی رشته‌ایِ ساده، بازتابِ خودمان را نادیده می‌گیریم و ورودیِ
  // کاربر هرگز بازنویسی نمی‌شود. سینک فقط برای مقادیرِ واقعاً بیرونی رخ می‌دهد.
  const emitted = useRef<string>(serializeIranPlate(parts));

  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setParts(load(value));
  }, [value]);

  const firstRef = useRef<HTMLInputElement>(null);
  const letterRef = useRef<HTMLSelectElement>(null);
  const middleRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const nextOf: Record<Box, React.RefObject<HTMLElement>> = {
    first: letterRef,
    middle: codeRef,
    code: codeRef,
  };

  const commit = (next: Parts) => {
    setParts(next);
    const s = serializeIranPlate(next);
    emitted.current = s;
    onChange(s);
  };

  const onDigits = (box: Box) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = toEnDigits(e.target.value).slice(0, LEN[box]);
    // نکته‌ی مهم: به‌جای تکیه بر state (که ممکن است در رویدادهای پشت‌سرهم کهنه باشد)،
    // با به‌روزرسانیِ تابعی، همیشه از آخرین بخش‌ها می‌سازیم.
    setParts(prev => {
      const next = { ...prev, [box]: clean };
      const s = serializeIranPlate(next);
      emitted.current = s;
      onChange(s);
      return next;
    });
    if (clean.length === LEN[box]) nextOf[box].current?.focus();
  };

  const onDigitKeyDown = (box: Box) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    if (e.key === 'Backspace' && el.value === '') {
      e.preventDefault();
      if (box === 'middle') letterRef.current?.focus();
      else if (box === 'code') middleRef.current?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const parsed = parseIranPlate(text);
    if (!parsed.first && !parsed.middle && !parsed.code) return;
    e.preventDefault();
    commit({ ...parsed, letter: parsed.letter || DEFAULT_PLATE_LETTER });
  };

  const cell = 'h-11 min-w-0 bg-white text-center text-base font-bold tabular-nums text-slate-900 outline-none ' +
    'placeholder:font-normal placeholder:text-slate-300 focus:bg-red-50 disabled:bg-slate-100 disabled:text-slate-400';

  return (
    <div
      dir="ltr"
      onPaste={onPaste}
      className={`inline-flex h-11 max-w-full select-none items-stretch overflow-hidden rounded-lg border-2 border-slate-800 bg-white shadow-sm focus-within:ring-2 focus-within:ring-red-500/30 ${className}`}
    >
      {/* نوار آبی سمت چپ، مطابق پلاک واقعی */}
      <span className="flex w-7 shrink-0 flex-col items-center justify-center gap-0.5 bg-[#1e3a8a] px-0.5 text-white">
        <span className="text-[9px] leading-none">🇮🇷</span>
        <span className="text-[5.5px] font-black leading-none tracking-tight">I.R.IRAN</span>
      </span>

      <input
        ref={firstRef}
        autoFocus={autoFocus}
        required={required}
        disabled={disabled}
        value={parts.first}
        onChange={onDigits('first')}
        onKeyDown={onDigitKeyDown('first')}
        onFocus={e => e.currentTarget.select()}
        inputMode="numeric"
        maxLength={LEN.first}
        autoComplete="off"
        placeholder="12"
        aria-label="دو رقم اول پلاک"
        className={`${cell} w-11 border-l-2 border-slate-800`}
      />

      <select
        ref={letterRef}
        required={required}
        disabled={disabled}
        value={parts.letter || DEFAULT_PLATE_LETTER}
        onChange={e => { commit({ ...parts, letter: e.target.value }); middleRef.current?.focus(); }}
        aria-label="حرف پلاک"
        className={`${cell} w-14 cursor-pointer appearance-none border-l-2 border-slate-800 px-0.5 text-sm`}
      >
        {IRAN_PLATE_LETTERS.map(l => <option key={l} value={l}>{l}</option>)}
      </select>

      <input
        ref={middleRef}
        required={required}
        disabled={disabled}
        value={parts.middle}
        onChange={onDigits('middle')}
        onKeyDown={onDigitKeyDown('middle')}
        onFocus={e => e.currentTarget.select()}
        inputMode="numeric"
        maxLength={LEN.middle}
        autoComplete="off"
        placeholder="345"
        aria-label="سه رقم پلاک"
        className={`${cell} w-14`}
      />

      {/* کد استان در پلاک واقعی با یک شکاف از بدنه جدا است */}
      <span className="w-1 shrink-0 bg-slate-800" aria-hidden />

      <input
        ref={codeRef}
        required={required}
        disabled={disabled}
        value={parts.code}
        onChange={onDigits('code')}
        onKeyDown={onDigitKeyDown('code')}
        onFocus={e => e.currentTarget.select()}
        inputMode="numeric"
        maxLength={LEN.code}
        autoComplete="off"
        placeholder="77"
        aria-label="کد استان پلاک"
        className={`${cell} w-11`}
      />
    </div>
  );
};

export default IranPlateInput;
