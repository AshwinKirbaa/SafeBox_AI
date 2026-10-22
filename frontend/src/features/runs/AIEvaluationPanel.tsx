import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RedactedEvidenceViewer } from './RedactedEvidenceViewer';
import type { AIEvaluationResult, TargetMode } from '@/types/api';
import { Bot, CheckCircle2, XCircle, FileText, Target } from 'lucide-react';

interface AIEvaluationPanelProps {
  evaluation: AIEvaluationResult;
  testName: string;
  testId: string;
  targetMode: TargetMode;
  mockBehavior?: string | null;
}

export const AIEvaluationPanel: React.FC<AIEvaluationPanelProps> = ({
  evaluation,
  testName,
  testId,
  targetMode,
  mockBehavior,
}) => {
  const isPass = evaluation.status === 'PASS';
  const isFail = evaluation.status === 'FAIL';
  const isError = evaluation.status === 'ERROR';

  const badgeVariant = isPass ? 'pass' : isFail ? 'fail' : isError ? 'danger' : 'pending';

  return (
    <Card
      glow={isFail ? 'fail' : isPass ? 'pass' : 'none'}
      headerSlot={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-mono text-cyan-400/90 tracking-wider uppercase font-semibold">
                Dimension 1
              </span>
              <h2 className="text-sm font-bold text-slate-100">
                AI Behavior Evaluation
              </h2>
            </div>
          </div>
          <Badge variant={badgeVariant} size="md">
            AI: {evaluation.status}
          </Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Test Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#090e1c] p-3 rounded-xl border border-[#1b2848]">
          <div>
            <span className="text-slate-500 font-mono block">Test Suite</span>
            <span className="text-slate-200 font-semibold">{testName}</span>
            <span className="text-[11px] text-cyan-400/80 font-mono block mt-0.5">{testId}</span>
          </div>
          <div>
            <span className="text-slate-500 font-mono block">Target Configuration</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="cyan" size="sm" icon={false}>
                {targetMode}
              </Badge>
              {mockBehavior && (
                <span className="text-xs font-mono text-slate-400">
                  behavior: <strong className={mockBehavior === 'vulnerable' ? 'text-rose-400' : 'text-emerald-400'}>{mockBehavior}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expected vs Observed Behavior */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-[#0b1222] border border-[#1b2b50]">
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1.5 font-semibold">
              <Target className="w-3.5 h-3.5" />
              <span>Expected Defensive Behavior</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {evaluation.expected_behavior}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#0b1222] border border-[#1b2b50]">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 mb-1.5 font-semibold">
              <FileText className="w-3.5 h-3.5" />
              <span>Observed Model Response</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {evaluation.observed_behavior}
            </p>
          </div>
        </div>

        {/* Findings Checklist */}
        {evaluation.findings && evaluation.findings.length > 0 && (
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Behavioral Findings ({evaluation.findings.length})
            </h3>
            <ul className="space-y-1.5">
              {evaluation.findings.map((finding, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 text-xs text-slate-300 bg-[#090e1c] p-2.5 rounded-lg border border-[#172340]"
                >
                  {isPass ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error details if any */}
        {evaluation.error_details && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-xs text-red-300">
            <strong className="font-mono block mb-1">Diagnostic Detail:</strong>
            {evaluation.error_details}
          </div>
        )}

        {/* Redacted Evidence */}
        <RedactedEvidenceViewer evidence={evaluation.redacted_evidence} />
      </div>
    </Card>
  );
};
