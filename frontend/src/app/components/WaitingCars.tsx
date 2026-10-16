import React from 'react';
import { Clock, ChevronLeft } from 'lucide-react';
import clsx from 'clsx';
import { OrderStage } from '../api/types';
import type { Order } from '../types';
import { STAGE_META } from '../lib/orderStages';
import { formatIranPlate } from './forms/IranPlateInput';

const fa = (n: number) => n.toLocaleString('fa-IR');

/**
 * Cars that are in the wash but not in any bay: waiting in a line, or washed and waiting to be
 * collected.
 *
 * The board only draws bays, so a car that left its bay for a queue simply vanished from it,
 * and there was no way back to it short of hunting through the orders list. This keeps every
 * car on site in view, in the order they will be served, with its place in line.
 */
export const WaitingCars = ({ orders, onOpen }: { orders: Order[]; onOpen: (orderId: string) => void }) => {
  if (orders.length === 0) return null;

  const groups: Array<[string, Order[]]> = [
    ['صف شستشو', orders.filter(o => o.stage === OrderStage.QueuedForWash || o.stage === OrderStage.Received)],
    ['صف خشک', orders.filter(o => o.stage === OrderStage.QueuedForDry)],
    ['آماده‌ی تحویل', orders.filter(o => o.stage === OrderStage.ReadyForPickup)],
    ['سایر', orders.filter(o => ![OrderStage.QueuedForWash, OrderStage.Received, OrderStage.QueuedForDry, OrderStage.ReadyForPickup].includes(o.stage))],
  ];

  return (
    <section className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-gray-900">خودروهای بیرون از جایگاه</h2>
        <span className="rounded-lg bg-gray-50 px-2 py-1 text-[11px] font-bold text-gray-600">{fa(orders.length)} خودرو</span>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {groups.filter(([, list]) => list.length > 0).map(([title, list]) => (
          <div key={title}>
            <div className="mb-2 text-[11px] font-bold text-gray-500">{title}</div>
            <div className="space-y-1.5">
              {list
                .slice()
                .sort((a, b) => (a.queuePosition ?? 999) - (b.queuePosition ?? 999) || a.createdAt.localeCompare(b.createdAt))
                .map(o => {
                  const minutes = Math.max(0, Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000));
                  const meta = STAGE_META[o.stage];
                  return (
                    <button key={o.id} onClick={() => onOpen(o.id)}
                      className="flex w-full items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-right hover:border-brand-200 hover:bg-brand-50/40">
                      <span className={clsx('grid size-8 flex-shrink-0 place-items-center rounded-xl text-xs font-extrabold',
                        o.queuePosition ? 'bg-sky-100 text-sky-700' : 'bg-gray-100 text-gray-500')}>
                        {o.queuePosition ? fa(o.queuePosition) : '—'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-xs font-bold text-gray-900">
                          {formatIranPlate(o.customerPlate) || o.customerPlate}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span className={clsx('rounded px-1.5 py-0.5 font-bold', meta?.tone)}>{meta?.label}</span>
                          <Clock size={10} />{fa(minutes)} دقیقه
                        </span>
                      </span>
                      <ChevronLeft size={15} className="flex-shrink-0 text-gray-300" />
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
