import React from 'react';
import { cn } from '@/lib/utils';
import { 
  ShieldCheck, 
  Info, 
  AlertCircle, 
  AlertTriangle, 
  AlertOctagon, 
  Flame, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';

export type SeverityLevel = 'none' | 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface SeverityBadgeProps {
  severity: SeverityLevel;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({
  severity,
  className,
  size = 'md',
  label,
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const config: Record<
    SeverityLevel,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    none: {
      label: 'Verified Clean',
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-500/40 shadow-[0_0_12px_-3px_rgba(52,211,153,0.3)]',
      icon: <ShieldCheck className={iconSizes} />,
    },
    info: {
      label: 'Informational',
      bg: 'bg-blue-950/60',
      text: 'text-blue-400',
      border: 'border-blue-500/40 shadow-[0_0_12px_-3px_rgba(59,130,246,0.3)]',
      icon: <Info className={iconSizes} />,
    },
    low: {
      label: 'Low Risk',
      bg: 'bg-sky-950/60',
      text: 'text-sky-300',
      border: 'border-sky-500/40 shadow-[0_0_12px_-3px_rgba(56,189,248,0.25)]',
      icon: <AlertCircle className={iconSizes} />,
    },
    medium: {
      label: 'Medium Risk',
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-500/50 shadow-[0_0_12px_-3px_rgba(251,191,36,0.3)]',
      icon: <AlertTriangle className={iconSizes} />,
    },
    high: {
      label: 'High Risk',
      bg: 'bg-rose-950/70',
      text: 'text-rose-400',
      border: 'border-rose-500/60 shadow-[0_0_14px_-2px_rgba(248,113,113,0.4)]',
      icon: <AlertOctagon className={iconSizes} />,
    },
    critical: {
      label: 'Critical Threat',
      bg: 'bg-[#FB7185]/20',
      text: 'text-[#FB7185]',
      border: 'border-2 border-[#FB7185] shadow-[0_0_16px_rgba(251,113,133,0.5)] font-bold',
      icon: <Flame className={cn(iconSizes, 'animate-pulse text-[#FB7185]')} />,
    },
  };

  const active = config[severity] || config.info;

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border tracking-wide uppercase font-mono transition-colors select-none',
        sizeClasses,
        active.bg,
        active.text,
        active.border,
        className
      )}
      role="status"
      aria-label={`Severity: ${label || active.label}`}
    >
      {active.icon}
      <span>{label || active.label}</span>
    </span>
  );
};

export type BadgeVariant =
  | 'pass'
  | 'fail'
  | 'pending'
  | 'running'
  | 'neutral'
  | 'cyan'
  | 'ok'
  | 'warn'
  | 'danger';

export interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  icon?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  children,
  icon = true,
  className,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  }[size];

  const variantStyles: Record<
    BadgeVariant,
    { bg: string; text: string; border: string; iconComponent: React.ReactNode }
  > = {
    pass: {
      bg: 'bg-emerald-950/70',
      text: 'text-emerald-400',
      border: 'border-emerald-700/60 shadow-[0_0_12px_-3px_rgba(16,185,129,0.3)]',
      iconComponent: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    ok: {
      bg: 'bg-emerald-950/70',
      text: 'text-emerald-400',
      border: 'border-emerald-700/60 shadow-[0_0_12px_-3px_rgba(52,211,153,0.3)]',
      iconComponent: <ShieldCheck className="w-3.5 h-3.5" />,
    },
    fail: {
      bg: 'bg-rose-950/70',
      text: 'text-rose-400',
      border: 'border-rose-700/60 shadow-[0_0_12px_-3px_rgba(244,63,94,0.3)]',
      iconComponent: <AlertOctagon className="w-3.5 h-3.5" />,
    },
    danger: {
      bg: 'bg-rose-950/70',
      text: 'text-rose-400',
      border: 'border-rose-600/70 shadow-[0_0_12px_-3px_rgba(248,113,113,0.4)]',
      iconComponent: <AlertOctagon className="w-3.5 h-3.5" />,
    },
    pending: {
      bg: 'bg-amber-950/70',
      text: 'text-amber-400',
      border: 'border-amber-700/60 shadow-[0_0_12px_-3px_rgba(245,158,11,0.3)]',
      iconComponent: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    warn: {
      bg: 'bg-amber-950/70',
      text: 'text-amber-400',
      border: 'border-amber-600/60 shadow-[0_0_12px_-3px_rgba(251,191,36,0.3)]',
      iconComponent: <AlertTriangle className="w-3.5 h-3.5" />,
    },
    running: {
      bg: 'bg-cyan-950/70',
      text: 'text-cyan-400',
      border: 'border-cyan-700/60 shadow-[0_0_12px_-3px_rgba(34,211,238,0.3)]',
      iconComponent: <Clock className="w-3.5 h-3.5 animate-spin" />,
    },
    neutral: {
      bg: 'bg-[#121826]',
      text: 'text-[#9AA6BD]',
      border: 'border-slate-700/50',
      iconComponent: <Info className="w-3.5 h-3.5" />,
    },
    cyan: {
      bg: 'bg-cyan-950/60',
      text: 'text-cyan-300',
      border: 'border-cyan-700/50 shadow-[0_0_10px_-3px_rgba(34,211,238,0.25)]',
      iconComponent: null,
    },
  };

  const current = variantStyles[variant] || variantStyles.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border tracking-wide uppercase font-mono transition-colors',
        sizeClasses,
        current.bg,
        current.text,
        current.border,
        className
      )}
    >
      {icon && current.iconComponent}
      <span>{children}</span>
    </span>
  );
};
