import React from 'react';
import { Shield, Lock, Cpu, Sparkles } from 'lucide-react';

interface VaultPoster2DProps {
  interactive?: boolean;
}

export const VaultPoster2D: React.FC<VaultPoster2DProps> = ({ interactive = true }) => {
  return (
    <div className="relative w-full aspect-square max-w-[500px] mx-auto flex items-center justify-center select-none">
      {/* Ambient background glow rings */}
      <div className="absolute inset-0 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-3/4 h-3/4 rounded-full bg-blue-600/10 blur-2xl pointer-events-none" />

      {/* SVG Faceted Glass Vault & Cyan Core */}
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full relative z-10 filter drop-shadow-[0_15px_35px_rgba(0,0,0,0.7)]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="posterOuterPlate" x1="50" y1="50" x2="450" y2="450" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1E293B" stopOpacity="0.85" />
            <stop offset="0.4" stopColor="#0F172A" stopOpacity="0.95" />
            <stop offset="1" stopColor="#05070D" stopOpacity="0.98" />
          </linearGradient>

          <linearGradient id="posterBorderNeon" x1="0" y1="0" x2="500" y2="500" gradientUnits="userSpaceOnUse">
            <stop stopColor="#38BDF8" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#0284C7" stopOpacity="0.5" />
          </linearGradient>

          <radialGradient id="posterCoreGlow" cx="250" cy="250" r="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22D3EE" stopOpacity="0.95" />
            <stop offset="0.3" stopColor="#06B6D4" stopOpacity="0.6" />
            <stop offset="0.7" stopColor="#0E7490" stopOpacity="0.2" />
            <stop offset="1" stopColor="#05070D" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="facetHighlight" x1="150" y1="100" x2="350" y2="300" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.02" />
          </linearGradient>

          <filter id="neonBlur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Outer Halo Ring */}
        <circle cx="250" cy="250" r="210" stroke="#22D3EE" strokeOpacity="0.15" strokeWidth="1.5" strokeDasharray="8 6" />
        <circle cx="250" cy="250" r="190" stroke="#3B82F6" strokeOpacity="0.1" strokeWidth="1" />

        {/* Outer Heavy Hexagonal Vault Door */}
        <polygon
          points="250,55 415,150 415,350 250,445 85,350 85,150"
          fill="url(#posterOuterPlate)"
          stroke="url(#posterBorderNeon)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Facet Geometries (Chiseled Glass Faces) */}
        <polygon points="250,55 415,150 330,200 250,160" fill="url(#facetHighlight)" />
        <polygon points="415,150 415,350 330,300 330,200" fill="#0A1022" fillOpacity="0.5" />
        <polygon points="415,350 250,445 250,340 330,300" fill="url(#facetHighlight)" />
        <polygon points="250,445 85,350 170,300 250,340" fill="#0A1022" fillOpacity="0.6" />
        <polygon points="85,350 85,150 170,200 170,300" fill="url(#facetHighlight)" />
        <polygon points="85,150 250,55 250,160 170,200" fill="#0A1022" fillOpacity="0.4" />

        {/* Concentric Rotating Cyber Locking Gear */}
        <circle cx="250" cy="250" r="125" stroke="#22D3EE" strokeOpacity="0.4" strokeWidth="2" strokeDasharray="16 8" />
        <circle cx="250" cy="250" r="105" stroke="#38BDF8" strokeOpacity="0.3" strokeWidth="1.5" strokeDasharray="6 4" />

        {/* Locking Bolt Rivets */}
        {[
          [250, 75], [395, 160], [395, 340], [250, 425], [105, 340], [105, 160]
        ].map(([bx, by], idx) => (
          <g key={idx}>
            <circle cx={bx} cy={by} r="7" fill="#0A1022" stroke="#22D3EE" strokeWidth="1.5" />
            <circle cx={bx} cy={by} r="3" fill="#22D3EE" />
          </g>
        ))}

        {/* Core Radiance Field */}
        <circle cx="250" cy="250" r="85" fill="url(#posterCoreGlow)" filter="url(#neonBlur)" />

        {/* Central Quantum Cyan Core */}
        <circle cx="250" cy="250" r="48" fill="#05070D" stroke="#22D3EE" strokeWidth="2.5" />
        <circle cx="250" cy="250" r="32" fill="#22D3EE" fillOpacity="0.85" filter="url(#neonBlur)" />
        <circle cx="250" cy="250" r="14" fill="#FFFFFF" />

        {/* Reticle Target Reticules */}
        <line x1="250" y1="180" x2="250" y2="215" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="250" y1="285" x2="250" y2="320" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="180" y1="250" x2="215" y2="250" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="285" y1="250" x2="320" y2="250" stroke="#22D3EE" strokeWidth="2.5" strokeLinecap="round" />
      </svg>

      {/* Floating Holographic Telemetry Badges */}
      <div className="absolute top-4 -left-2 sm:left-4 z-20 flex items-center gap-2 bg-[#0A1022]/90 border border-cyan-500/30 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg text-xs font-mono text-cyan-300">
        <Cpu className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
        <span>SHA-256 Engine: ACTIVE</span>
      </div>

      <div className="absolute bottom-6 -right-2 sm:right-4 z-20 flex items-center gap-2 bg-[#0A1022]/90 border border-emerald-500/30 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg text-xs font-mono text-emerald-300">
        <Lock className="w-3.5 h-3.5 text-emerald-400" />
        <span>Vault At-Rest: AES-256</span>
      </div>
    </div>
  );
};
