import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Receipt, Printer, X, Gift, Sparkles, Check } from 'lucide-react';
import { useCarWash } from '../store';
import { Logo } from './Logo';

export const InvoiceModal = ({ id, onClose }: { id: string | null; onClose: () => void }) => {
  const { orders, workers, getOrderTotals, customerForOrder } = useCarWash();
  const printRef = useRef<HTMLDivElement>(null);

  if (!id) return null;
  const order = orders.find(o => o.id === id);
  if (!order) return null;
  const totals = getOrderTotals(order);
  const customer = customerForOrder(order);

  const handlePrint = () => {
    if (!printRef.current) return;
    const html = printRef.current.innerHTML;
    const w = window.open('', '_blank', 'width=420,height=720');
    if (!w) return;
    w.document.write(`
      <html dir="rtl">
        <head>
          <title>فاکتور SmartWash</title>
          <meta charset="utf-8" />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" />
          <style>
            body { font-family: 'Vazirmatn', sans-serif; padding: 20px; color: #111; }
            .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .total { border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 8px; font-weight: bold; }
            h1 { text-align: center; font-size: 18px; margin: 0 0 4px 0; }
            .sub { text-align: center; font-size: 11px; color: #666; margin-bottom: 16px; }
            .free { color: #059669; }
            .strike { text-decoration: line-through; color: #999; }
            hr { border: 0; border-top: 1px dashed #ddd; margin: 12px 0; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
          dir="rtl"
          className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        >
          <div className="bg-gradient-to-br from-red-500 via-red-600 to-red-700 text-white p-6 text-center flex-shrink-0 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="mx-auto mb-2 relative w-20 h-20 flex items-center justify-center">
              <Logo size={72} />
            </div>
            <div className="font-extrabold text-lg relative">فاکتور SmartWash</div>
            <div className="text-xs text-red-100 font-mono mt-1 relative">#{order.id.slice(-8).toUpperCase()}</div>
            <div className="text-[10px] text-red-100 mt-1 relative">{new Date(order.createdAt).toLocaleString('fa-IR')}</div>
          </div>

          <div className="overflow-y-auto flex-1">
            <div ref={printRef} className="p-6 space-y-3 text-sm">
              <h1 style={{ display: 'none' }}>SmartWash</h1>
              <div className="sub" style={{ display: 'none' }}>سامانه مدیریت کارواش</div>

              {customer && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <div className="row flex justify-between"><span className="text-gray-500">مشتری</span><span className="font-bold">{customer.name}</span></div>
                  <div className="row flex justify-between"><span className="text-gray-500">پلاک</span><span className="font-mono font-bold">{order.customerPlate}</span></div>
                  {order.customerPhone && <div className="row flex justify-between"><span className="text-gray-500">تماس</span><span className="font-mono">{order.customerPhone}</span></div>}
                </div>
              )}

              <hr />

              <div className="space-y-2">
                {order.lineItems.length === 0 && <div className="text-gray-400 text-xs text-center py-4">سرویسی ثبت نشده</div>}
                {order.lineItems.map(li => {
                  const w = workers.find(x => x.id === li.workerId);
                  return (
                    <div key={li.id} className="space-y-0.5">
                      <div className="row flex justify-between">
                        <span className={li.isFree ? 'free' : ''}>
                          {li.isFree && '🎁 '}{li.serviceName}
                        </span>
                        <span className={`font-mono ${li.isFree ? 'strike' : ''}`}>{li.price.toLocaleString('fa-IR')}</span>
                      </div>
                      {w && <div className="text-[10px] text-gray-400">توسط: {w.name}</div>}
                      {li.tipAmount > 0 && (
                        <div className="row flex justify-between text-[11px] text-blue-600">
                          <span>↳ انعام</span>
                          <span className="font-mono">+{li.tipAmount.toLocaleString('fa-IR')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <hr />

              <div className="space-y-1">
                <div className="row flex justify-between text-gray-500"><span>جمع خدمات</span><span className="font-mono">{totals.subtotal.toLocaleString('fa-IR')}</span></div>
                {totals.freeDiscount > 0 && <div className="row flex justify-between text-emerald-600"><span>🎁 جایزه وفاداری</span><span className="font-mono">−{totals.freeDiscount.toLocaleString('fa-IR')}</span></div>}
                {totals.discount > 0 && <div className="row flex justify-between text-amber-600"><span>تخفیف</span><span className="font-mono">−{totals.discount.toLocaleString('fa-IR')}</span></div>}
                {totals.tips > 0 && <div className="row flex justify-between text-blue-600"><span>انعام پرسنل</span><span className="font-mono">+{totals.tips.toLocaleString('fa-IR')}</span></div>}
              </div>

              <div className="total flex justify-between items-center border-t border-dashed border-gray-200 pt-3">
                <span className="font-bold">جمع نهایی</span>
                <span className="font-mono font-extrabold text-lg">{totals.total.toLocaleString('fa-IR')} ت</span>
              </div>

              {order.freeServiceApplied && (
                <div className="bg-emerald-50 text-emerald-700 rounded-xl p-2 text-center text-xs flex items-center justify-center gap-1.5">
                  <Sparkles size={13} />
                  <span>یک خدمت رایگان به عنوان جایزه باشگاه مشتریان</span>
                </div>
              )}

              <div className="text-center text-[10px] text-gray-400 pt-2">با تشکر از انتخاب شما — SmartWash</div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 border-t border-gray-100 grid grid-cols-2 gap-2 flex-shrink-0">
            <button onClick={handlePrint} className="bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
              <Printer size={15} /> چاپ
            </button>
            <button onClick={onClose} className="bg-white border border-gray-200 hover:bg-gray-100 text-gray-900 py-3 rounded-2xl font-bold text-sm transition-colors">
              بستن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
