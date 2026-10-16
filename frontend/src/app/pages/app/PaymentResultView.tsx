import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { billingApi, ApiException } from '../../api';

type PaymentState = 'loading' | 'success' | 'failed';

export const PaymentResultView: React.FC = () => {
  const [params] = useSearchParams();
  const status = params.get('status');
  const paymentId = params.get('paymentId');
  const authority = params.get('Authority') ?? params.get('authority') ?? params.get('trans_id') ?? '';
  const code = params.get('code');

  const [state, setState] = useState<PaymentState>(() =>
    status === 'success' ? 'loading' : 'failed'
  );
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (status !== 'success' || !paymentId) {
      setState('failed');
      setMessage(code === 'Payment.Cancelled' ? 'پرداخت توسط شما لغو شد.' : 'پرداخت ناموفق بود. لطفاً مجدداً تلاش کنید.');
      return;
    }

    // double-verify در صورتی که callback فقط به JSON جواب داده باشد
    if (authority) {
      billingApi.verifyPayment(paymentId, authority)
        .then(() => { setState('success'); setMessage('پرداخت با موفقیت انجام شد. اشتراک شما فعال است.'); })
        .catch((e: unknown) => {
          const msg = e instanceof ApiException ? e.message : 'خطا در تأیید پرداخت.';
          setState('failed');
          setMessage(msg);
        });
    } else {
      // اگر backend redirect کرده و verify از قبل انجام شده
      setState('success');
      setMessage('پرداخت با موفقیت انجام شد. اشتراک شما فعال است.');
    }
  }, [status, paymentId, authority, code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4" dir="rtl">
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-10 max-w-md w-full text-center space-y-6">
        {state === 'loading' && (
          <>
            <Loader2 size={56} className="mx-auto animate-spin text-brand-500" />
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">در حال تأیید پرداخت…</h1>
            <p className="text-gray-500 text-sm">لطفاً صبر کنید.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 size={64} className="mx-auto text-emerald-500" />
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">پرداخت موفق ✓</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{message}</p>
            <Link
              to="/app/billing"
              className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
            >
              <ArrowLeft size={16} /> مشاهده اشتراک
            </Link>
          </>
        )}

        {state === 'failed' && (
          <>
            <XCircle size={64} className="mx-auto text-red-500" />
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">پرداخت ناموفق</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{message}</p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/app/billing"
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-2xl transition-colors"
              >
                تلاش مجدد
              </Link>
              <Link
                to="/app/bays"
                className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium px-5 py-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                بازگشت
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentResultView;
