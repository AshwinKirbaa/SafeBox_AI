import React from 'react';
import { LucideIcon, FolderSearch } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = FolderSearch,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-card bg-[#0A1022]/60 border border-[rgba(148,163,184,0.14)]',
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-[#121826] border border-cyan-500/20 flex items-center justify-center text-accent-cyan mb-4 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-[#E6EBF5] font-heading mb-1">{title}</h3>
      <p className="text-sm text-[#9AA6BD] max-w-sm mb-5 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
