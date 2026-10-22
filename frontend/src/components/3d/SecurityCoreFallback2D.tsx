import React from 'react';
import { Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SecurityCoreFallbackProps {
  status?: 'idle' | 'running' | 'pass' | 'ai_fail' | 'infra_fail' | 'disconnected';
  className?: string;
}

export const SecurityCoreFallback2D: React.FC<SecurityCoreFallbackProps> = ({
  status = 'idle',
  className,
}) => {
  const statusColors = {
    idle: {
      ring: 'border-cyan-500/30 text-cyan-400 bg-cyan-950/20',
      glow: 'shadow-[0_0_30px_rgba(0,240,255,0.2)]',
      label: 'Security Core Active (2D Mode)',
    },
    running: {
      ring: 'border-cyan-400 text-cyan-300 bg-cyan-950/40 animate-pulse',
      glow: 'shadow-[0_0_40px_rgba(0,240,255,0.4)]',
      label: 'Scanning & Evaluating...',
    },
    pass: {
      ring: 'border-emerald-500 text-emerald-400 bg-emerald-950/30',
      glow: 'shadow-[0_0_40px_rgba(16,185,129,0.3)]',
      label: 'Verified Secure',
    },
    ai_fail: {
      ring: 'border-amber-500 text-amber-400 bg-amber-950/30',
      glow: 'shadow-[0_0_40px_rgba(245,158,11,0.3)]',
      label: 'AI Vulnerability Detected',
    },
    infra_fail: {
      ring: 'border-rose-500 text-rose-400 bg-rose-950/30',
      glow: 'shadow-[0_0_40px_rgba(244,63,94,0.3)]',
      label: 'Infrastructure Boundary Alert',
    },
    disconnected: {
      ring: 'border-slate-700 text-slate-500 bg-slate-900/40',
      glow: '',
      label: 'Backend Offline',
    },
  }[status];

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center p-8 rounded-2xl bg-[#090e1c] border border-[#1f2e52]',
        className
      )}
    >
      <div className="relative flex items-center justify-center w-48 h-48 sm:w-56 sm:h-56">
        {/* Outer Ring */}
        <div
          className={cn(
            'absolute inset-0 rounded-full border-2 border-dashed border-opacity-40 animate-[spin_20s_linear_infinite]',
            statusColors.ring
          )}
        />
        {/* Inner Orbit */}
        <div
          className={cn(
            'absolute inset-4 rounded-full border border-opacity-60 animate-[spin_12s_linear_infinite_reverse]',
            statusColors.ring
          )}
        />
        {/* Center Shield Icon */}
        <div
          className={cn(
            'relative z-10 w-24 h-24 rounded-2xl border-2 flex items-center justify-center transition-all duration-500',
            statusColors.ring,
            statusColors.glow
          )}
        >
          {status === 'pass' ? (
            <CheckCircle2 className="w-12 h-12 stroke-[1.8]" />
          ) : status === 'infra_fail' || status === 'ai_fail' ? (
            <AlertCircle className="w-12 h-12 stroke-[1.8]" />
          ) : (
            <Shield className="w-12 h-12 stroke-[1.8]" />
          )}
        </div>
      </div>
      <div className="mt-4 text-center">
        <p className="text-sm font-mono font-medium text-slate-300">{statusColors.label}</p>
        <p className="text-xs text-slate-500 mt-0.5">Hardware WebGL acceleration optional</p>
      </div>
    </div>
  );
};
