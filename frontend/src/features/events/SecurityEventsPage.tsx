import React, { useState } from 'react';
import { useVault } from '@/lib/vaultContext';
import { SeverityBadge, SeverityLevel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  AlertOctagon, 
  Sparkles, 
  Check, 
  Filter, 
  Clock, 
  ShieldCheck, 
  X,
  FileText
} from 'lucide-react';

export const SecurityEventsPage: React.FC = () => {
  const { securityEvents, acknowledgeSecurityEvent, generateWeeklySummary } = useVault();
  const [severityFilter, setSeverityFilter] = useState<string | 'all'>('all');
  const [weeklySummaryModal, setWeeklySummaryModal] = useState<{
    summary: string;
    advisory: boolean;
    eventCount: number;
  } | null>(null);

  const filteredEvents = securityEvents.filter((e) => {
    if (severityFilter === 'all') return true;
    return e.severity === severityFilter;
  });

  const handleOpenWeeklySummary = () => {
    const summary = generateWeeklySummary();
    setWeeklySummaryModal(summary);
  };

  return (
    <div className="space-y-8 animate-in fade-in select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.12)] gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white tracking-tight">
            Security Events
          </h1>
          <p className="text-xs sm:text-sm text-[#9AA6BD] mt-1 font-mono">
            Cryptographic drift alerts, type spoofing blocks, and real-time posture changes
          </p>
        </div>

        {/* Summarize This Week AI Feature (Mandated by PDF SPEC page 9 & 24) */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenWeeklySummary}
          className="shadow-[0_0_15px_rgba(34,211,238,0.25)] gap-1.5"
        >
          <Sparkles className="w-4 h-4 text-accent-cyan" />
          <span>Summarize This Week (AI)</span>
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#9AA6BD]">Severity Filter:</span>
          {['all', 'none', 'medium', 'high', 'critical'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1 rounded transition-colors uppercase ${
                severityFilter === sev
                  ? 'bg-[#1A2236] text-accent-cyan font-bold border border-cyan-500/40'
                  : 'text-[#9AA6BD] hover:text-white'
              }`}
            >
              {sev === 'none' ? 'Info/Clean' : sev}
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-[#9AA6BD]">
          {filteredEvents.length} events logged
        </span>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <EmptyState
          title="No security events logged"
          description="Your vault is healthy. New integrity anomalies and scanner notifications will appear here."
        />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map((evt) => (
            <div
              key={evt.id}
              className="p-5 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-2 top-light-border"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={evt.severity} size="sm" />
                  <span className="text-xs font-mono font-bold text-white tracking-wider">
                    {evt.type}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-[#9AA6BD]">
                    {new Date(evt.created_at).toLocaleString()}
                  </span>
                  {!evt.acknowledged_at ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => acknowledgeSecurityEvent(evt.id)}
                      className="text-xs h-7"
                    >
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Acknowledge
                    </Button>
                  ) : (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Acknowledged
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-slate-200 leading-relaxed font-sans">{evt.message}</p>

              {evt.file_name && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 pt-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Target: {evt.file_name}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* AI Weekly Summary Modal (Mandated by PDF SPEC) */}
      {weeklySummaryModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-lg bg-[#0A1022] border border-cyan-500/40 rounded-card shadow-2xl p-6 space-y-5 top-light-border">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-accent-cyan">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading text-white">
                    Weekly Security Digest
                  </h3>
                  <span className="text-xs font-mono text-accent-cyan">
                    AI Summary • Advisory Label Enforced
                  </span>
                </div>
              </div>
              <button
                onClick={() => setWeeklySummaryModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans bg-[#121826] p-4 rounded-card border border-[rgba(148,163,184,0.12)]">
              {weeklySummaryModal.summary}
            </p>

            <div className="p-3 bg-[#05070D] rounded border border-amber-500/30 text-[11px] font-mono text-amber-300 italic">
              Advisory: AI event summaries are generated from metadata only. They do not constitute a certified compliance audit.
            </div>

            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setWeeklySummaryModal(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
