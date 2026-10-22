import React, { useState } from 'react';
import {
  X,
  History,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Box,
} from 'lucide-react';
import type { SecurityTestRunResponse } from '@/types/api';
import { copyToClipboard } from '@/lib/utils';

interface RunHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  runs: SecurityTestRunResponse[];
  currentRunId: string | null;
  onSelectRun: (run: SecurityTestRunResponse) => void;
}

export const RunHistoryDrawer: React.FC<RunHistoryDrawerProps> = ({
  isOpen,
  onClose,
  runs,
  currentRunId,
  onSelectRun,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(id);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md h-full bg-[#111318] border-l border-[#30343e] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="h-14 px-5 border-b border-[#222630] bg-[#171a20]/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[#42d9ff]">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#f3f5f8]">Evaluation Run History</h2>
              <span className="text-[10px] font-mono text-[#9ca4b3]">
                {runs.length} evaluations recorded in backend store
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] transition-colors"
            title="Close Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Runs List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {runs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs space-y-2">
              <History className="w-8 h-8 mx-auto opacity-40 text-slate-400" />
              <p>No historical runs found in backend cache.</p>
              <p className="text-[11px] text-slate-600">
                Execute a security workflow to register your first evaluation run.
              </p>
            </div>
          ) : (
            runs.map((run) => {
              const isSelected = run.run_id === currentRunId;
              const aiPass = run.ai_evaluation.status === 'PASS';
              const infraPass = run.infrastructure_verification?.status === 'PASS';

              return (
                <div
                  key={run.run_id}
                  onClick={() => {
                    onSelectRun(run);
                    onClose();
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#171a20] border-[#42d9ff] shadow-[0_0_16px_rgba(66,217,255,0.15)] ring-1 ring-[#42d9ff]'
                      : 'bg-[#090a0d] border-[#222630] hover:border-[#3a4150] hover:bg-[#111318]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-[#f3f5f8] block leading-snug">
                        {run.test_name}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[#697386]">
                        <span>{new Date(run.created_at).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span className="uppercase">{run.target_mode}</span>
                        {run.mock_behavior && (
                          <>
                            <span>•</span>
                            <span className={run.mock_behavior === 'vulnerable' ? 'text-rose-400' : 'text-emerald-400'}>
                              {run.mock_behavior}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* AI Verdict */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase flex items-center gap-1 ${
                          aiPass
                            ? 'bg-emerald-950/80 text-[#31d89a] border border-emerald-800'
                            : 'bg-rose-950/80 text-[#ff526d] border border-rose-800'
                        }`}
                      >
                        {aiPass ? (
                          <CheckCircle2 className="w-2.5 h-2.5" />
                        ) : (
                          <XCircle className="w-2.5 h-2.5" />
                        )}
                        <span>AI: {run.ai_evaluation.status}</span>
                      </span>

                      {/* Docker Infra Verdict */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase flex items-center gap-1 ${
                          infraPass
                            ? 'bg-emerald-950/40 text-emerald-400'
                            : 'bg-rose-950/40 text-rose-400'
                        }`}
                      >
                        <Box className="w-2.5 h-2.5" />
                        <span>Docker: {run.infrastructure_verification?.status || 'N/A'}</span>
                      </span>
                    </div>
                  </div>

                  {/* Run ID & Load Action */}
                  <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-[#171a20] text-[10px] font-mono text-[#697386]">
                    <div className="flex items-center gap-1 truncate max-w-[200px]">
                      <span className="truncate">{run.run_id}</span>
                      <button
                        onClick={(e) => handleCopy(run.run_id, e)}
                        className="p-0.5 rounded hover:bg-[#1e222a] text-slate-400 hover:text-white"
                        title="Copy Run ID"
                      >
                        {copiedId === run.run_id ? (
                          <Check className="w-2.5 h-2.5 text-[#31d89a]" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                      </button>
                    </div>

                    <span className="text-[#42d9ff] font-semibold flex items-center gap-1 group-hover:underline">
                      <span>Load on Canvas</span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
