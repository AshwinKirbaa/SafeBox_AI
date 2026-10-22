import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-card bg-[#121826]/80 border border-rose-500/30',
        className
      )}
      role="alert"
    >
      <div className="w-14 h-14 rounded-full bg-rose-950/40 border border-rose-500/40 flex items-center justify-center text-rose-400 mb-4 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-[#E6EBF5] font-heading mb-1">{title}</h3>
      <p className="text-sm text-[#9AA6BD] max-w-md mb-5 leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 border-rose-500/30 hover:border-rose-500 text-rose-300">
          <RefreshCw className="w-4 h-4" />
          <span>Retry Operation</span>
        </Button>
      )}
    </div>
  );
};
