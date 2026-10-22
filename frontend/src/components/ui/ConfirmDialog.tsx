import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requiresTypedWord?: string;
  warningNote?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  requiresTypedWord,
  warningNote,
}) => {
  const [typedInput, setTypedInput] = useState('');

  if (!isOpen) return null;

  const isConfirmedDisabled = requiresTypedWord
    ? typedInput.trim().toUpperCase() !== requiresTypedWord.toUpperCase()
    : false;

  const handleConfirm = () => {
    onConfirm();
    setTypedInput('');
    onClose();
  };

  const handleClose = () => {
    setTypedInput('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="relative w-full max-w-md bg-[#0A1022] border border-[rgba(148,163,184,0.2)] rounded-card shadow-2xl p-6 overflow-hidden">
        {/* Glow Accent */}
        <div
          className={cn(
            'absolute -top-12 -right-12 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-20',
            isDestructive ? 'bg-rose-500' : 'bg-cyan-500'
          )}
        />

        <div className="flex items-start gap-4">
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
              isDestructive
                ? 'bg-rose-950/60 text-rose-400 border border-rose-600/40'
                : 'bg-amber-950/60 text-amber-400 border border-amber-600/40'
            )}
          >
            {isDestructive ? <AlertOctagon className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-[#E6EBF5] font-heading">
              {title}
            </h3>
            <p className="text-sm text-[#9AA6BD] mt-1.5 leading-relaxed">{description}</p>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {warningNote && (
          <div className="mt-4 p-3 bg-amber-950/30 border border-amber-500/30 rounded text-xs text-amber-200">
            <strong>Security Warning:</strong> {warningNote}
          </div>
        )}

        {requiresTypedWord && (
          <div className="mt-4">
            <label className="block text-xs font-mono text-[#9AA6BD] mb-1.5">
              Type <span className="text-rose-400 font-bold">{requiresTypedWord}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={requiresTypedWord}
              className="w-full bg-[#121826] border border-slate-700 focus:border-rose-500 rounded-input px-3 py-2 text-sm text-[#E6EBF5] font-mono tracking-wider focus:outline-none"
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            size="sm"
            disabled={isConfirmedDisabled}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
