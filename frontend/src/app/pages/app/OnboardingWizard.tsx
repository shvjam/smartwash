import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Circle, Building2, Square, Sparkles, ArrowLeft, Loader2 } from 'lucide-react';
import { tomanNumber } from '../../lib/money';
import {
  onboardingApi, branchesApi, baysApi, servicesApi, ApiException,
  type OnboardingStateDto,
} from '../../api';

type StepKey = 'branch' | 'bay' | 'service' | 'done';

const PRESET_SERVICES: Array<{ name: string; category: 0 | 1 | 2; priceRials: number; durationMinutes: number }> = [
  { name: 'شست‌وشوی ساده', category: 0, priceRials: 500_000, durationMinutes: 20 },
  { name: 'شست‌وشوی کامل', category: 0, priceRials: 1_200_000, durationMinutes: 40 },
  { name: 'صفرشویی', category: 1, priceRials: 3_500_000, durationMinutes: 90 },
];

export const OnboardingWizard: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingStateDto | null>(null);
  const [current, setCurrent] = useState<StepKey>('branch');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // form state
  const [branchForm, setBranchForm] = useState({ name: 'شعبه اصلی', address: '', phone: '' });
  const [bayCount, setBayCount] = useState(2);
  const [pickedServices, setPickedServices] = useState<boolean[]>([true, true, false]);
  const [createdBranchId, setCreatedBranchId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const s = await onboardingApi.state();
      setState(s);
      if (s.isComplete) { navigate('/app/bays', { replace: true }); return; }
      if (!s.hasBranch) setCurrent('branch');
      else if (!s.hasBay) setCurrent('bay');
      else if (!s.hasService) setCurrent('service');
      else setCurrent('done');
      if (s.hasBranch) {
        try {
          const list = await branchesApi.list(false);
          if (list[0]) setCreatedBranchId(list[0].id);
        } catch { /* ignore */ }
      }
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در بارگذاری وضعیت');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, []);

  const submitBranch = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      const b = await branchesApi.create({
        name: branchForm.name.trim(),
        address: branchForm.address.trim() || null,
        phone: branchForm.phone.trim() || null,
        isDefault: true,
      });
      setCreatedBranchId(b.id);
      await onboardingApi.completeStep(1);
      setCurrent('bay');
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در ساخت شعبه'); }
    finally { setBusy(false); }
  };

  const submitBays = async () => {
    if (!createdBranchId) { setErr('شعبه پیدا نشد'); return; }
    setErr(null); setBusy(true);
    try {
      for (let i = 1; i <= bayCount; i++) {
        await baysApi.create({ branchId: createdBranchId, name: `جایگاه ${toFa(i)}`, number: i });
      }
      await onboardingApi.completeStep(2);
      setCurrent('service');
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در ساخت جایگاه‌ها'); }
    finally { setBusy(false); }
  };

  const submitServices = async () => {
    setErr(null); setBusy(true);
    try {
      const picks = PRESET_SERVICES.filter((_, i) => pickedServices[i]);
      if (picks.length === 0) { setErr('حداقل یک خدمت را انتخاب کنید.'); setBusy(false); return; }
      for (const s of picks) {
        await servicesApi.create({
          name: s.name, description: null, category: s.category as any,
          priceRials: s.priceRials, durationMinutes: s.durationMinutes,
          workerCommissionRate: 0.1,
        });
      }
      await onboardingApi.completeStep(3);
      setCurrent('done');
      setTimeout(() => navigate('/app/bays', { replace: true }), 1200);
    } catch (e) { setErr(e instanceof ApiException ? e.message : 'خطا در ساخت خدمات'); }
    finally { setBusy(false); }
  };

  if (loading) return (
    <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin" /></div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-10 px-4 pt-8" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6">
          <h1>خوش آمدید! بیایید کارواش شما را راه‌اندازی کنیم</h1>
          <p className="text-muted-foreground">سه گام کوتاه تا شروع کار با پلتفرم.</p>
        </div>

        <StepBar current={current} state={state} />

        {err && <div className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 text-destructive p-3">{err}</div>}

        <div className="mt-6 rounded-xl border bg-card p-6">
          {current === 'branch' && (
            <form onSubmit={submitBranch} className="space-y-4">
              <h2>گام ۱ — ساخت اولین شعبه</h2>
              <Field label="نام شعبه" value={branchForm.name} onChange={v => setBranchForm({ ...branchForm, name: v })} required />
              <Field label="نشانی (اختیاری)" value={branchForm.address} onChange={v => setBranchForm({ ...branchForm, address: v })} />
              <Field label="تلفن (اختیاری)" value={branchForm.phone} onChange={v => setBranchForm({ ...branchForm, phone: v })} />
              <PrimaryButton busy={busy}>ادامه</PrimaryButton>
            </form>
          )}

          {current === 'bay' && (
            <div className="space-y-4">
              <h2>گام ۲ — افزودن جایگاه‌ها</h2>
              <p className="text-muted-foreground">چند جایگاه شست‌وشو دارید؟</p>
              <div className="flex items-center gap-2">
                <button type="button" className="rounded-md border px-3 py-2"
                  onClick={() => setBayCount(Math.max(1, bayCount - 1))}>−</button>
                <span className="min-w-12 text-center text-2xl">{toFa(bayCount)}</span>
                <button type="button" className="rounded-md border px-3 py-2"
                  onClick={() => setBayCount(Math.min(20, bayCount + 1))}>+</button>
              </div>
              <PrimaryButton busy={busy} onClick={submitBays}>ساخت جایگاه‌ها و ادامه</PrimaryButton>
            </div>
          )}

          {current === 'service' && (
            <div className="space-y-4">
              <h2>گام ۳ — انتخاب خدمات پایه</h2>
              <p className="text-muted-foreground">می‌توانید بعداً قیمت‌ها و خدمات بیشتر را در «خدمات» تنظیم کنید.</p>
              <div className="space-y-2">
                {PRESET_SERVICES.map((s, i) => (
                  <label key={s.name} className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-accent">
                    <input type="checkbox" checked={pickedServices[i]} onChange={e => {
                      const arr = [...pickedServices]; arr[i] = e.target.checked; setPickedServices(arr);
                    }} />
                    <div className="flex-1">
                      <div>{s.name}</div>
                      <div className="text-muted-foreground">{tomanNumber(s.priceRials)} تومان · {toFa(s.durationMinutes)} دقیقه</div>
                    </div>
                  </label>
                ))}
              </div>
              <PrimaryButton busy={busy} onClick={submitServices}>پایان راه‌اندازی</PrimaryButton>
            </div>
          )}

          {current === 'done' && (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
              <h2>راه‌اندازی کامل شد!</h2>
              <p className="text-muted-foreground">در حال انتقال به داشبورد…</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const StepBar: React.FC<{ current: StepKey; state: OnboardingStateDto | null }> = ({ current, state }) => {
  const steps: Array<{ key: StepKey; label: string; Icon: React.FC<any>; done: boolean }> = [
    { key: 'branch',  label: 'شعبه',   Icon: Building2, done: !!state?.hasBranch },
    { key: 'bay',     label: 'جایگاه', Icon: Square,    done: !!state?.hasBay },
    { key: 'service', label: 'خدمت',   Icon: Sparkles,  done: !!state?.hasService },
  ];
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const active = s.key === current;
        return (
          <React.Fragment key={s.key}>
            <div className={`flex items-center gap-2 rounded-md px-3 py-2 ${active ? 'bg-primary/10 text-primary' : s.done ? 'text-emerald-600' : 'text-muted-foreground'}`}>
              {s.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              <s.Icon size={16} />
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && <ArrowLeft size={14} className="text-muted-foreground" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; required?: boolean }> = ({ label, value, onChange, required }) => (
  <label className="block">
    <span className="block mb-1">{label}</span>
    <input className="w-full rounded-md border bg-background px-3 py-2"
      value={value} onChange={e => onChange(e.target.value)} required={required} />
  </label>
);

const PrimaryButton: React.FC<{ busy?: boolean; onClick?: () => void; children: React.ReactNode }> = ({ busy, onClick, children }) => (
  <button type={onClick ? 'button' : 'submit'} onClick={onClick} disabled={busy}
    className="w-full rounded-md bg-primary text-primary-foreground py-2.5 disabled:opacity-50">
    {busy ? <Loader2 className="inline animate-spin" size={16} /> : children}
  </button>
);

const toFa = (v: number | string) => String(v).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[+d]);

export default OnboardingWizard;
