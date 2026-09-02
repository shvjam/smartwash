import React, { useEffect, useState } from 'react';
import { Plus, Wallet, Pencil, Trash2, X, Check } from 'lucide-react';
import { expensesApi, type ExpenseDto, ExpenseCategory, PaymentMethod, ApiException } from '../../api';
import { useCarWash } from '../../store';
import { PageHeader, Card, StatCard, EmptyState } from '../../components/app/PageHeader';
import { toJalaliLabel } from '../../lib/persian';

const fmt = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const categories: { v: ExpenseCategory; l: string }[] = [
  { v: ExpenseCategory.Salary, l: 'حقوق' }, { v: ExpenseCategory.Rent, l: 'اجاره' },
  { v: ExpenseCategory.Utilities, l: 'قبوض' }, { v: ExpenseCategory.Supplies, l: 'تأمین' },
  { v: ExpenseCategory.Maintenance, l: 'تعمیرات' }, { v: ExpenseCategory.Marketing, l: 'بازاریابی' },
  { v: ExpenseCategory.Tax, l: 'مالیات' }, { v: ExpenseCategory.Other, l: 'متفرقه' },
];
const catLabel = (c: ExpenseCategory) => categories.find(x => x.v === c)?.l ?? '-';

type FormState = {
  category: ExpenseCategory; title: string; amountRials: string;
  paymentMethod: PaymentMethod; date: string; description: string;
};
const emptyForm = (): FormState => ({
  category: ExpenseCategory.Supplies, title: '', amountRials: '',
  paymentMethod: PaymentMethod.Cash, date: new Date().toISOString().slice(0, 10), description: '',
});

export const ExpensesView = () => {
  const { branchId } = useCarWash();
  const [list, setList] = useState<ExpenseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    if (!branchId) return;
    try { setList((await expensesApi.search({ branchId, pageSize: 100 })).items); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [branchId]);

  const openNew = () => { setEditingId(null); setForm(emptyForm()); setErr(null); setShowForm(true); };
  const openEdit = (e: ExpenseDto) => {
    setEditingId(e.id);
    setForm({
      category: e.category, title: e.title, amountRials: String(e.amountRials),
      paymentMethod: e.paymentMethod, date: e.date, description: e.description ?? '',
    });
    setErr(null);
    setShowForm(true);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!branchId) return;
    setErr(null);
    const body = {
      category: form.category, title: form.title.trim(),
      amountRials: Number(form.amountRials) || 0, paymentMethod: form.paymentMethod,
      date: form.date, description: form.description.trim() || null,
    };
    try {
      if (editingId) {
        const updated = await expensesApi.update(editingId, body);
        setList(prev => prev.map(e => e.id === editingId ? updated : e));
      } else {
        if (!branchId) return;
        await expensesApi.create({ branchId, ...body });
        reload();
      }
      setShowForm(false); setEditingId(null); setForm(emptyForm());
    } catch (e) {
      setErr(e instanceof ApiException ? e.message : 'خطا در ثبت هزینه');
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('آیا از حذف این هزینه مطمئن هستید؟')) return;
    try { await expensesApi.delete(id); setList(prev => prev.filter(x => x.id !== id)); }
    catch { /* ignore */ }
  };

  const total = list.reduce((s, e) => s + e.amountRials, 0);
  const byCat = categories.map(c => ({ ...c, total: list.filter(e => e.category === c.v).reduce((s, e) => s + e.amountRials, 0) }))
    .filter(c => c.total > 0).sort((a, b) => b.total - a.total).slice(0, 4);

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <PageHeader
        title="مدیریت هزینه‌ها"
        subtitle="ثبت و دسته‌بندی هزینه‌های ماهانه کارواش"
        actions={
          <button onClick={openNew}
            className="bg-gradient-to-br from-red-500 to-red-700 text-white px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-1.5 shadow-lg shadow-red-500/30">
            <Plus size={16} />هزینه جدید
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard accent="red" label="جمع هزینه‌ها" value={fmt(total)} hint="مجموع همه دسته‌ها" />
        {byCat.map(c => <StatCard key={c.v} accent="amber" label={c.l} value={fmt(c.total)} />)}
      </div>

      {showForm && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">{editingId ? 'ویرایش هزینه' : 'ثبت هزینه جدید'}</h3>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-2 rounded-xl hover:bg-gray-100"><X size={16} /></button>
          </div>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">دسته‌بندی</span>
              <select value={form.category} onChange={e => setForm({ ...form, category: Number(e.target.value) })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20">
                {categories.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">روش پرداخت</span>
              <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: Number(e.target.value) })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20">
                <option value={PaymentMethod.Cash}>نقدی</option>
                <option value={PaymentMethod.Card}>کارتی</option>
                <option value={PaymentMethod.Online}>آنلاین</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600 mb-2 block">عنوان</span>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">مبلغ (ریال)</span>
              <input required type="number" value={form.amountRials} onChange={e => setForm({ ...form, amountRials: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600 mb-2 block">تاریخ</span>
              <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500/20" />
              {/* The browser's picker is Gregorian and cannot be switched, so the Jalali date
                  is echoed here — otherwise the person is converting in their head. */}
              {form.date && (
                <span className="mt-1.5 block text-xs font-bold text-red-600">{toJalaliLabel(form.date)}</span>
              )}
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600 mb-2 block">توضیحات</span>
              <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20" />
            </label>
            {err && <div className="sm:col-span-2 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-2xl">{err}</div>}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="bg-gray-900 text-white px-5 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2">
                <Check size={14} />{editingId ? 'ذخیره تغییرات' : 'ثبت هزینه'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-5 py-2.5 rounded-2xl border border-gray-200 text-sm">انصراف</button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-10">در حال بارگذاری…</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Wallet} title="هنوز هزینه‌ای ثبت نشده" hint="با ثبت اولین هزینه، گزارش‌های مالی شما شکل می‌گیرد." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-right text-xs text-gray-500">
                  <th className="px-5 py-3 font-medium">تاریخ</th>
                  <th className="px-5 py-3 font-medium">دسته</th>
                  <th className="px-5 py-3 font-medium">عنوان</th>
                  <th className="px-5 py-3 font-medium">مبلغ</th>
                  <th className="px-5 py-3 font-medium">پرداخت</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {list.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 group">
                    <td className="px-5 py-3 text-gray-700">{new Date(e.date).toLocaleDateString('fa-IR')}</td>
                    <td className="px-5 py-3"><span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">{catLabel(e.category)}</span></td>
                    <td className="px-5 py-3 font-bold">{e.title}{e.description && <span className="block text-[11px] text-gray-400 font-normal">{e.description}</span>}</td>
                    <td className="px-5 py-3 font-bold font-mono">{fmt(e.amountRials)} ریال</td>
                    <td className="px-5 py-3 text-xs text-gray-500">{e.paymentMethod === PaymentMethod.Cash ? 'نقدی' : e.paymentMethod === PaymentMethod.Card ? 'کارتی' : 'آنلاین'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ExpensesView;
