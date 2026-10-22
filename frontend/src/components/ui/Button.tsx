import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
      md: 'px-4 py-2 text-sm rounded-lg gap-2',
      lg: 'px-6 py-2.5 text-base rounded-xl gap-2.5',
    }[size];

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-[0_0_20px_-3px_rgba(0,240,255,0.4)] hover:shadow-[0_0_25px_0px_rgba(0,240,255,0.6)] border border-cyan-300/40',
      secondary:
        'bg-[#172340] hover:bg-[#203157] text-cyan-300 font-medium border border-cyan-800/60 shadow-sm hover:border-cyan-500/50',
      outline:
        'bg-transparent hover:bg-slate-800/50 text-slate-200 font-medium border border-slate-700 hover:border-slate-500',
      danger:
        'bg-rose-600/90 hover:bg-rose-500 text-white font-semibold shadow-[0_0_20px_-3px_rgba(244,63,94,0.4)] border border-rose-400/40',
      ghost:
        'bg-transparent hover:bg-slate-800/40 text-slate-300 hover:text-white',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center font-sans tracking-wide transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-[#080c14] disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]',
          sizeClasses,
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
