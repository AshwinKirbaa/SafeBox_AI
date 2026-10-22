import React, { useState } from 'react';
import { useVault } from '@/lib/vaultContext';
import { SeverityBadge, SeverityLevel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { 
  ShieldAlert, 
  Cpu, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  FileText, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Sliders
} from 'lucide-react';

interface AnalysisPageProps {
  onSelectFile?: (fileId: string) => void;
}

export const AnalysisPage: React.FC<AnalysisPageProps> = ({ onSelectFile }) => {
  const { analyses, files, isScannerConfigured, toggleScannerConfigured, acknowledgeFinding } = useVault();
  const [severityFilter, setSeverityFilter] = useState<string | 'all'>('all');

  const filteredAnalyses = analyses.filter((a) => {
    if (severityFilter === 'all') return true;
    return a.severity === severityFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.12)] gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white tracking-tight">
            Security Analysis Hub
          </h1>
          <p className="text-xs sm:text-sm text-[#9AA6BD] mt-1 font-mono">
            Deterministic static inspection rules, VirusTotal engine reports, and advisory AI explanations
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Scanner Adapter Simulation Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleScannerConfigured}
            className="text-xs font-mono"
            title="Toggle between configured API key and unconfigured setup state"
          >
            <Sliders className="w-3.5 h-3.5 mr-1.5" />
            Scanner: {isScannerConfigured ? 'Configured (Active)' : 'Unconfigured'}
          </Button>
        </div>
      </div>

      {/* Integration Adapter Status Card */}
      {!isScannerConfigured ? (
        <div className="p-5 rounded-card bg-[#121826] border border-amber-500/50 space-y-3 top-light-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-base font-bold font-heading">
                Scanner Adapter Unconfigured
              </h3>
            </div>
            <span className="text-xs font-mono text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
              Setup Required
            </span>
          </div>
          <p className="text-xs text-[#9AA6BD] leading-relaxed">
            Per SafeBox AI honesty requirements, no fake scan results are ever fabricated. An external malware scanning key has not been configured in backend secrets.
          </p>
          <div className="p-3 bg-[#0A1022] rounded border border-slate-800 text-xs font-mono text-cyan-300">
            Platform Secret Required: <strong>VIRUSTOTAL_API_KEY</strong>
          </div>
          <p className="text-[11px] text-slate-500 font-mono">
            Until configured, files remain in "Scanner not configured" state. Hashes are still computed and verified locally.
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-card bg-[#0A1022] border border-cyan-500/30 flex items-center justify-between top-light-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-accent-cyan">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold font-heading text-white">VirusTotal Adapter: Connected</h4>
              <span className="text-xs font-mono text-[#9AA6BD]">
                Hash-Only Lookup Mode (Zero file bytes leave storage) • 72 Threat Engines Active
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-emerald-400 font-bold hidden sm:inline">
            ● READY
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-[#9AA6BD]">Filter by Severity:</span>
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
              {sev === 'none' ? 'Clean' : sev}
            </button>
          ))}
        </div>

        <span className="text-xs font-mono text-[#9AA6BD]">
          Showing {filteredAnalyses.length} reports
        </span>
      </div>

      {/* Analyses Stream */}
      {filteredAnalyses.length === 0 ? (
        <EmptyState
          title="No analyses found"
          description="Upload files to run deterministic static checks and external scanner lookups."
        />
      ) : (
        <div className="space-y-4">
          {filteredAnalyses.map((analysis) => {
            const file = files.find((f) => f.id === analysis.file_id);
            return (
              <div
                key={analysis.id}
                className="p-6 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-4 top-light-border"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-accent-cyan" />
                    <div>
                      <h3 className="text-base font-bold font-heading text-white">
                        {file ? file.display_name : 'Unknown File Object'}
                      </h3>
                      <span className="text-xs font-mono text-[#9AA6BD]">
                        Engine: {analysis.engine} • Started {new Date(analysis.started_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={analysis.severity} size="md" />
                    {!analysis.acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acknowledgeFinding(analysis.id)}
                        className="text-xs h-7"
                      >
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Acknowledge
                      </Button>
                    )}
                  </div>
                </div>

                {/* Findings Table */}
                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#9AA6BD] block uppercase tracking-wider">
                    Deterministic Findings ({analysis.findings.length})
                  </span>
                  <div className="space-y-2">
                    {analysis.findings.map((f, i) => (
                      <div
                        key={i}
                        className="p-3 rounded bg-[#121826] border border-slate-800 flex items-start justify-between gap-4 text-xs font-mono"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-white">{f.title}</strong>
                            <span className="text-[10px] text-slate-500">[{f.code}]</span>
                          </div>
                          <p className="text-[#9AA6BD] mt-1 leading-relaxed">{f.detail}</p>
                        </div>
                        <SeverityBadge severity={f.severity} size="sm" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Advisory Report Section */}
                {analysis.ai_report && (
                  <div className="p-4 rounded-card bg-[#121826] border border-cyan-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-accent-cyan flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" /> AI Advisory Explanation
                      </span>
                      <span className="text-[10px] font-mono text-amber-400/90 italic">
                        {analysis.ai_report.disclaimer}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      {analysis.ai_report.plain_explanation}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
