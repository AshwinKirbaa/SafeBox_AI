import React from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: 'cyan' | 'teal' | 'fail' | 'pass' | 'none';
  interactive?: boolean;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = 'none',
  interactive = false,
  headerSlot,
  footerSlot,
  ...props
}) => {
  const glowStyles = {
    cyan: 'border-cyan-500/40 shadow-[0_4px_30px_-5px_rgba(0,240,255,0.2)]',
    teal: 'border-teal-500/40 shadow-[0_4px_30px_-5px_rgba(0,229,176,0.2)]',
    fail: 'border-rose-500/50 shadow-[0_4px_30px_-5px_rgba(244,63,94,0.25)]',
    pass: 'border-emerald-500/50 shadow-[0_4px_30px_-5px_rgba(16,185,129,0.25)]',
    none: 'border-[#1b2b4d]',
  }[glow];

  const interactiveStyles = interactive
    ? 'cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-[0_16px_40px_-10px_rgba(0,240,255,0.22)]'
    : 'transition-colors duration-200';

  return (
    <div
      className={cn(
        'relative bg-[#0b1222]/85 backdrop-blur-xl border rounded-2xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] group',
        'before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-cyan-400/25 before:to-transparent before:pointer-events-none',
        glowStyles,
        interactiveStyles,
        className
      )}
      {...props}
    >
      {headerSlot && (
        <div className="px-5 py-3.5 border-b border-[#1b2b4d] bg-[#0d162b]/80 flex items-center justify-between relative z-10">
          {headerSlot}
        </div>
      )}
      <div className="p-5 relative z-10">{children}</div>
      {footerSlot && (
        <div className="px-5 py-3 border-t border-[#1b2b4d] bg-[#0d162b]/60 relative z-10">
          {footerSlot}
        </div>
      )}
    </div>
  );
};
