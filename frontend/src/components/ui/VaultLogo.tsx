import React from 'react';
import { cn } from '@/lib/utils';

interface VaultLogoProps {
  className?: string;
  size?: number;
  glow?: boolean;
  animated?: boolean;
}

export const VaultLogo: React.FC<VaultLogoProps> = ({
  className,
  size = 36,
  glow = true,
  animated = false,
}) => {
  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center select-none flex-shrink-0',
        glow && 'filter drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]',
        className
      )}
      style={{ width: size, height: size }}
      aria-label="SafeBox AI 'The Core' Vault Mark"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('w-full h-full', animated && 'transition-transform duration-700 hover:rotate-30')}
      >
        <defs>
          <linearGradient id="vaultOuterFacet" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E293B" />
            <stop offset="0.5" stopColor="#0F172A" />
            <stop offset="1" stopColor="#05070D" />
          </linearGradient>

          <linearGradient id="vaultBorderGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0.8" />
            <stop offset="0.5" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#0284C7" stopOpacity="0.4" />
          </linearGradient>

          <radialGradient id="coreGlowGrad" cx="50" cy="50" r="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" stopOpacity="1" />
            <stop offset="0.4" stopColor="#06B6D4" stopOpacity="0.8" />
            <stop offset="0.8" stopColor="#0E7490" stopOpacity="0.3" />
            <stop offset="1" stopColor="#05070D" stopOpacity="0" />
          </radialGradient>

          <filter id="coreGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagonal Heavy Armor Plate */}
        <polygon
          points="50,4 90,26 90,74 50,96 10,74 10,26"
          fill="url(#vaultOuterFacet)"
          stroke="url(#vaultBorderGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Facet Lines (Geometric Vault Door Chiseled Edges) */}
        <line x1="50" y1="4" x2="50" y2="28" stroke="#334155" strokeWidth="1.2" strokeOpacity="0.8" />
        <line x1="90" y1="26" x2="69" y2="38" stroke="#334155" strokeWidth="1.2" strokeOpacity="0.8" />
        <line x1="90" y1="74" x2="69" y2="62" stroke="#334155" strokeWidth="1.2" strokeOpacity="0.8" />
        <line x1="50" y1="96" x2="50" y2="72" stroke="#334155" strokeWidth="1.2" strokeOpacity="0.8" />
        <line x1="10" y1="74" x2="31" y2="62" stroke="#334155" strokeWidth="1.2" strokeOpacity="0.8" />
        <line x1="10" y1="26" x2="31" y2="38" stroke="#334155" strokeWidth="1.2" strokeOpacity="0.8" />

        {/* Intermediate Rotating Locking Ring */}
        <polygon
          points="50,22 74,36 74,64 50,78 26,64 26,36"
          fill="#0A1022"
          stroke="#06B6D4"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          strokeOpacity="0.7"
        />

        {/* Hexagonal Locking Bolts */}
        <circle cx="50" cy="12" r="1.8" fill="#38BDF8" opacity="0.9" />
        <circle cx="83" cy="31" r="1.8" fill="#38BDF8" opacity="0.9" />
        <circle cx="83" cy="69" r="1.8" fill="#38BDF8" opacity="0.9" />
        <circle cx="50" cy="88" r="1.8" fill="#38BDF8" opacity="0.9" />
        <circle cx="17" cy="69" r="1.8" fill="#38BDF8" opacity="0.9" />
        <circle cx="17" cy="31" r="1.8" fill="#38BDF8" opacity="0.9" />

        {/* Inner Glowing Aperture (The Core) */}
        <circle cx="50" cy="50" r="16" fill="url(#coreGlowGrad)" filter="url(#coreGlow)" />
        <circle cx="50" cy="50" r="12" stroke="#22D3EE" strokeWidth="1.8" fill="#05070D" fillOpacity="0.4" />
        <circle cx="50" cy="50" r="5" fill="#22D3EE" />

        {/* Cyan Reticle Crosshairs */}
        <line x1="50" y1="34" x2="50" y2="42" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="50" y1="58" x2="50" y2="66" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="34" y1="50" x2="42" y2="50" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="58" y1="50" x2="66" y2="50" stroke="#22D3EE" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};
