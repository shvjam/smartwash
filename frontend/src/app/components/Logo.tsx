import React from 'react';
import { useNavigate } from 'react-router';
import { clsx } from 'clsx';

export const BRAND_NAME = 'SmartWash';
export const BRAND_TAGLINE = 'سامانه مدیریت کارواش';

// Self-contained inline SVG logo — no external file needed, works on any host.
export const Logo = ({ size = 56, className }: { size?: number; className?: string }) => {
  const navigate = useNavigate();
  const goHome = () => navigate('/');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      onClick={goHome}
      role="img"
      aria-label={`رفتن به صفحه اصلی ${BRAND_NAME}`}
      className={clsx('flex-shrink-0 cursor-pointer', className)}
      style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.08))' }}
    >
      <rect width="64" height="64" rx="16" fill="url(#sw-grad)" />
      {/* Car silhouette */}
      <path
        d="M14 38c0-1 .6-2 1.6-2.4l4-1.6 3.4-6.2c.7-1.2 2-2 3.4-2h11.2c1.4 0 2.7.8 3.4 2l3.4 6.2 4 1.6c1 .4 1.6 1.4 1.6 2.4v5a2 2 0 0 1-2 2h-2.2a4 4 0 0 1-7.6 0H25.8a4 4 0 0 1-7.6 0H16a2 2 0 0 1-2-2v-5z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Shine bubbles */}
      <circle cx="47" cy="20" r="3" fill="white" fillOpacity="0.9" />
      <circle cx="53" cy="26" r="2" fill="white" fillOpacity="0.7" />
      <circle cx="42" cy="15" r="1.6" fill="white" fillOpacity="0.6" />
      <defs>
        <linearGradient id="sw-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#E8262C" />
          <stop offset="1" stopColor="#A81D20" />
        </linearGradient>
      </defs>
    </svg>
  );
};
