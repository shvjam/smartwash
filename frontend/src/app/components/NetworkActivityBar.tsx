import React, { useEffect, useState } from 'react';
import { networkActivity } from '../api/client';

/**
 * A thin bar across the top of the window while the app is talking to the server.
 *
 * Shown only after a short delay, so reads that come back at once do not make the screen
 * flicker, and in the brand colour while something is being saved, since that is the moment
 * a person is waiting to see whether their click took.
 */
export const NetworkActivityBar = () => {
  const [visible, setVisible] = useState(false);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = networkActivity.subscribe((pending, isWriting) => {
      setWriting(isWriting);
      if (pending > 0) {
        if (!timer) timer = setTimeout(() => setVisible(true), isWriting ? 0 : 250);
      } else {
        if (timer) { clearTimeout(timer); timer = undefined; }
        setVisible(false);
      }
    });
    return () => { unsubscribe(); if (timer) clearTimeout(timer); };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 150ms' }}
    >
      <div className={`sw-activity-bar h-full w-1/3 ${writing ? 'bg-brand-500' : 'bg-gray-400'}`} />
    </div>
  );
};
