import { isRouteErrorResponse, useRouteError } from 'react-router';

/**
 * Keeps a route failure from falling back to React Router's development error
 * screen. The app is explicitly marked non-translatable because DOM-mutating
 * translator extensions can otherwise break React reconciliation on navigation.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();
  const isResponse = isRouteErrorResponse(error);
  const title = isResponse && error.status === 404 ? 'این صفحه پیدا نشد' : 'نمایش این صفحه با مشکل روبه‌رو شد';
  const detail = isResponse
    ? (error.statusText || 'لطفاً آدرس صفحه را بررسی کنید.')
    : 'می‌توانید به داشبورد برگردید یا صفحه را دوباره بارگذاری کنید.';

  return (
    <main dir="rtl" translate="no" className="notranslate grid min-h-screen place-items-center bg-[#f5f5f7] p-5 text-right">
      <section className="w-full max-w-md rounded-3xl border border-rose-100 bg-white p-7 shadow-xl shadow-rose-950/5">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-xl text-rose-600">!</div>
        <h1 className="text-xl font-extrabold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm leading-7 text-gray-500">{detail}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/app/bays" className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700">
            بازگشت به داشبورد
          </a>
          <button type="button" onClick={() => window.location.reload()} className="rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50">
            بارگذاری مجدد
          </button>
        </div>
      </section>
    </main>
  );
}
