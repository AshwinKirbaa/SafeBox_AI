import React, { useState } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Box,
  Bot,
  ExternalLink,
  Target,
} from 'lucide-react';
import type { SecurityTestRunResponse } from '@/types/api';
import { AIEvaluationPanel } from '@/features/runs/AIEvaluationPanel';
import { InfrastructureVerificationPanel } from '@/features/runs/InfrastructureVerificationPanel';
import { copyToClipboard } from '@/lib/utils';

interface FullRunDetailsModalProps {
  run: SecurityTestRunResponse | null;
  isOpen: boolean;
  onClose: () => void;
  onChecksUpdated?: () => void;
}

export const FullRunDetailsModal: React.FC<FullRunDetailsModalProps> = ({
  run,
  isOpen,
  onClose,
  onChecksUpdated,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !run) return null;

  const handleCopyId = async () => {
    const ok = await copyToClipboard(run.run_id);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const aiPass = run.ai_evaluation.status === 'PASS';
  const aiFail = run.ai_evaluation.status === 'FAIL';
  const infraPass = run.infrastructure_verification?.status === 'PASS';
  const infraFail = run.infrastructure_verification?.status === 'FAIL';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-[#111318] border border-[#30343e] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="h-14 px-6 border-b border-[#222630] bg-[#171a20]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-950 border border-cyan-800 flex items-center justify-center text-[#42d9ff]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#f3f5f8]">{run.test_name}</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e222a] text-cyan-300 border border-[#30343e] uppercase">
                  {run.target_mode}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#697386]">
                <span>Run ID: {run.run_id}</span>
                <button
                  onClick={handleCopyId}
                  className="p-0.5 rounded hover:bg-[#1e222a] text-slate-400 hover:text-white"
                  title="Copy Run ID"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-[#31d89a]" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <span>•</span>
                <span>{new Date(run.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] transition-colors"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Two-Dimension Summary Callout */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              aiFail && infraPass
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                : aiPass && infraPass
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                : aiFail && infraFail
                ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                : 'bg-cyan-950/30 border-cyan-800/60 text-cyan-300'
            }`}
          >
            <div>
              <h3 className="font-bold font-mono uppercase tracking-wide text-sm mb-0.5">
                {aiFail && infraPass
                  ? 'AI Vulnerability Detected — Contained in Docker Sandbox'
                  : aiPass && infraPass
                  ? 'Optimal Security Baseline Achieved'
                  : aiFail && infraFail
                  ? 'CRITICAL ALERT: Both AI & Infrastructure Controls Failed'
                  : 'Independent Verification Completed'}
              </h3>
              <p className="text-slate-300 text-xs">
                {aiFail && infraPass
                  ? 'The target model succumbed to prompt injection. However, all 7 container isolation boundaries held firmly without host compromise.'
                  : aiPass && infraPass
                  ? 'Both the AI safety evaluation and all 7 Docker containment checks passed independently.'
                  : 'AI safety and infrastructure containment are evaluated across two separate independent dimensions.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-2 py-1 rounded text-xs font-mono font-bold uppercase border ${
                  aiPass
                    ? 'bg-emerald-950 text-[#31d89a] border-emerald-800'
                    : 'bg-rose-950 text-[#ff526d] border-rose-800'
                }`}
              >
                AI: {run.ai_evaluation.status}
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-mono font-bold uppercase border ${
                  infraPass
                    ? 'bg-emerald-950 text-[#31d89a] border-emerald-800'
                    : 'bg-rose-950 text-[#ff526d] border-rose-800'
                }`}
              >
                Docker: {run.infrastructure_verification?.status || 'N/A'}
              </span>
            </div>
          </div>

          {/* Grid with Dimension 1 & Dimension 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Dimension 1: AI Evaluation Panel */}
            <AIEvaluationPanel
              evaluation={run.ai_evaluation}
              testName={run.test_name}
              testId={run.test_id}
              targetMode={run.target_mode}
              mockBehavior={run.mock_behavior}
            />

            {/* Dimension 2: Infrastructure Verification Panel */}
            <InfrastructureVerificationPanel
              infrastructure={run.infrastructure_verification}
              runId={run.run_id}
              onChecksUpdated={onChecksUpdated}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
