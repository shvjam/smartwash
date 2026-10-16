import React, { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import clsx from 'clsx';

/**
 * A member of staff, shown as their photo or as a person icon.
 *
 * Every screen used to solve this for itself, and none of them solved it the same way.
 * Three of them rendered a bare <img> with no fallback, so a worker without a photo got the
 * browser's broken-image glyph. The rest pointed at ui-avatars.com, a foreign service that
 * draws the person's initials — which is what people were seeing instead of a photo, and
 * which also meant every staff name was being sent to a third party, on every page load,
 * from a server in Iran where that request may simply never come back.
 *
 * So the fallback is drawn here instead. No network, nothing to block, and a worker with no
 * photo yet looks deliberate rather than broken.
 */
export const WorkerAvatar = ({
  src,
  name,
  size = 40,
  className,
  rounded = 'full',
}: {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  rounded?: 'full' | 'xl' | '2xl';
}) => {
  const [failed, setFailed] = useState(false);

  // A worker whose photo is replaced keeps the same element, so the previous failure has to
  // be forgotten or the new photo would never be given a chance to load.
  useEffect(() => { setFailed(false); }, [src]);

  const shape = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-2xl';
  const box = clsx('flex-shrink-0 overflow-hidden bg-brand-50', shape, className);
  const style = { width: size, height: size };

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ? `عکس ${name}` : ''}
        width={size}
        height={size}
        style={style}
        className={clsx(box, 'object-cover')}
        onError={() => setFailed(true)}
        draggable={false}
      />
    );
  }

  return (
    <div
      style={style}
      className={clsx(box, 'grid place-items-center text-brand-400')}
      role="img"
      aria-label={name ? `${name} — بدون عکس` : 'بدون عکس'}
      title={name}
    >
      <User size={Math.max(12, Math.round(size * 0.55))} strokeWidth={2} />
    </div>
  );
};
