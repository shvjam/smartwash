import React from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';

export const BRAND_NAME = 'SmartWash';
export const BRAND_TAGLINE = 'سامانه مدیریت کارواش';

/**
 * The brand emblem, from the same artwork the installed app icon is built from
 * (frontend/brand + scripts/make-icons.py). It used to be an inline SVG drawn separately,
 * which meant the header and the home-screen icon were two different marks that had to be
 * kept in step by hand.
 *
 * The wordmark is deliberately not part of this: every placement already sits next to the
 * name in text, and at 36px the lettering would be unreadable.
 */
export const Logo = ({ size = 56, className }: { size?: number; className?: string }) => {
  const navigate = useNavigate();
  return (
    <img
      src="/logo-mark.png"
      width={size}
      height={size}
      onClick={() => navigate('/')}
      role="img"
      alt={`رفتن به صفحه اصلی ${BRAND_NAME}`}
      className={clsx('flex-shrink-0 cursor-pointer object-contain', className)}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
      draggable={false}
    />
  );
};
