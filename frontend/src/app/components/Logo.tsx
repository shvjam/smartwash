import React from 'react';
import { useNavigate } from 'react-router';
import clsx from 'clsx';
import { useBranding } from '../lib/branding';

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
 *
 * `brand` decides whose mark this is. It defaults to the platform's, because the marketing
 * site, the sign-in screen and the platform console all speak for SmartWash — a carwash's
 * logo on the pricing page would be wrong. Inside a carwash's own panel, pass "tenant" and
 * their uploaded logo replaces it when they have one and their plan includes branding.
 */
export const Logo = ({ size = 56, className, brand = 'platform' }: {
  size?: number;
  className?: string;
  brand?: 'platform' | 'tenant';
}) => {
  const navigate = useNavigate();
  const { logoUrl } = useBranding();
  const tenantLogo = brand === 'tenant' ? logoUrl : null;

  return (
    <img
      src={tenantLogo ?? '/logo-mark.png'}
      width={size}
      height={size}
      onClick={() => navigate('/')}
      role="img"
      alt={tenantLogo ? 'رفتن به صفحه اصلی' : `رفتن به صفحه اصلی ${BRAND_NAME}`}
      className={clsx('flex-shrink-0 cursor-pointer object-contain', className)}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
      draggable={false}
      // A logo the carwash uploaded can 404 later; falling back keeps a broken
      // image icon out of the header and the printed invoice.
      onError={e => { (e.currentTarget as HTMLImageElement).src = '/logo-mark.png'; }}
    />
  );
};
