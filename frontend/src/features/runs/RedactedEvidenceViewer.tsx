import React, { useState } from 'react';
import { Copy, Check, ShieldAlert, ChevronDown, ChevronUp } from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';

interface RedactedEvidenceViewerProps {
  evidence: string[];
  title?: string;
}

export const RedactedEvidenceViewer: React.FC<RedactedEvidenceViewerProps> = ({
  evidence,
  title = 'Redacted Adversarial Evidence',
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<boolean>(true);

  if (!evidence || evidence.length === 0) {
    return (
      <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400 font-mono italic">
        No evidence payload recorded for this evaluation.
      </div>
    );
  }

  const handleCopy = async (text: string, idx: number) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  // Safe tokenizer for redaction tags (never using dangerouslySetInnerHTML!)
  const renderSafeTokens = (line: string) => {
    const parts = line.split(/(\[REDACTED_[A-Z0-9_]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('[REDACTED_') && part.endsWith(']')) {
        return (
          <span
            key={i}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-cyan-950 border border-cyan-700/80 text-cyan-300 font-mono text-[11px] font-bold tracking-tight shadow-[0_0_8px_rgba(0,240,255,0.3)]"
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="rounded-xl border border-[#1f2e52] bg-[#090e1c] overflow-hidden">
      <div
        className="px-4 py-2.5 bg-[#0f172a] border-b border-[#1f2e52] flex items-center justify-between cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-semibold text-slate-200 uppercase tracking-wide">
            {title} ({evidence.length})
          </span>
        </div>
        <button
          className="p-1 text-slate-400 hover:text-white"
          aria-label={expanded ? 'Collapse evidence' : 'Expand evidence'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
          {evidence.map((line, idx) => (
            <div
              key={idx}
              className="relative group p-2.5 rounded-lg bg-[#0d1424] border border-[#1b2848] text-xs font-mono text-slate-300 leading-relaxed break-words"
            >
              <div className="pr-8">{renderSafeTokens(line)}</div>
              <button
                onClick={() => handleCopy(line, idx)}
                className="absolute top-2 right-2 p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy safe evidence string"
                aria-label="Copy safe evidence string"
              >
                {copiedIndex === idx ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
