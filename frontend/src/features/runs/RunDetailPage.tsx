import React from 'react';
import { ArrowLeft, RotateCw, Copy, Check, Clock, Calendar, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { AIEvaluationPanel } from './AIEvaluationPanel';
import { InfrastructureVerificationPanel } from './InfrastructureVerificationPanel';
import { useRunDetail } from '@/hooks/useRuns';
import { formatDate, copyToClipboard } from '@/lib/utils';

interface RunDetailPageProps {
  runId: string;
  onBack: () => void;
}

export const RunDetailPage: React.FC<RunDetailPageProps> = ({ runId, onBack }) => {
  const { run, isLoading, error, refreshRun } = useRunDetail(runId);
  const [copiedId, setCopiedId] = React.useState(false);

  const handleCopyId = async () => {
    if (!run) return;
    const ok = await copyToClipboard(run.run_id);
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-24" />
        </div>
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="p-8 rounded-2xl bg-[#0d1424] border border-red-900/60 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-800 text-red-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Run Evaluation Not Found</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">{error || 'Unable to retrieve run record.'}</p>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Console</span>
          </Button>
          <Button variant="primary" onClick={refreshRun}>
            <RotateCw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    );
  }

  const aiPass = run.ai_evaluation.status === 'PASS';
  const aiFail = run.ai_evaluation.status === 'FAIL';
  const infraPass = run.infrastructure_verification?.status === 'PASS';
  const infraFail = run.infrastructure_verification?.status === 'FAIL';

  // Dynamic explanation banner clarifying the two dimensions
  let bannerTheme = 'bg-cyan-950/30 border-cyan-800/60 text-cyan-300';
  let bannerTitle = 'Evaluation Completed';
  let bannerDesc = 'AI and Infrastructure dimensions evaluated independently.';

  if (aiFail && infraPass) {
    bannerTheme = 'bg-amber-950/30 border-amber-800/60 text-amber-300';
    bannerTitle = 'AI Vulnerability Detected — Contained in Docker Sandbox';
    bannerDesc = 'The target AI model succumbed to the adversarial attack. However, Docker sandbox isolation successfully contained the process without host compromise.';
  } else if (aiPass && infraPass) {
    bannerTheme = 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300';
    bannerTitle = 'Optimal Security Baseline Achieved';
    bannerDesc = 'Both the AI safety evaluation and all 7 Docker containment checks passed independently.';
  } else if (aiFail && infraFail) {
    bannerTheme = 'bg-rose-950/30 border-rose-800/60 text-rose-300';
    bannerTitle = 'CRITICAL ALERT: Both AI & Infrastructure Controls Failed';
    bannerDesc = 'The target model exhibited unsafe behavior AND container isolation boundaries reported security violations.';
  } else if (aiPass && infraFail) {
    bannerTheme = 'bg-rose-950/30 border-rose-800/60 text-rose-300';
    bannerTitle = 'Infrastructure Isolation Failure';
    bannerDesc = 'The AI model behaved safely, but underlying Docker container configuration failed isolation checks.';
  }

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBack} size="sm" className="self-start text-slate-300">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Back to History</span>
        </Button>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={refreshRun}>
            <RotateCw className="w-3.5 h-3.5 mr-1.5" />
            <span>Refresh Run</span>
          </Button>
        </div>
      </div>

      {/* State Combination Banner */}
      <div className={`p-4 rounded-xl border ${bannerTheme} flex items-start gap-3`}>
        {aiFail || infraFail ? (
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
        ) : (
          <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />
        )}
        <div>
          <h3 className="font-bold text-sm tracking-wide">{bannerTitle}</h3>
          <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-sans">{bannerDesc}</p>
        </div>
      </div>

      {/* Run Metadata Header Card */}
      <div className="p-5 rounded-2xl bg-[#0d1424]/90 border border-[#1f2e52] cyber-top-light backdrop-blur-sm shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-100 font-mono">{run.run_id}</h2>
            <button
              onClick={handleCopyId}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Copy Run ID"
              aria-label="Copy Run ID"
            >
              {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-xs text-cyan-400 font-mono mt-0.5">{run.test_name}</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>{formatDate(run.created_at)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={aiPass ? 'pass' : 'fail'} size="sm">
              AI: {run.ai_evaluation.status}
            </Badge>
            <Badge variant={infraPass ? 'pass' : infraFail ? 'fail' : 'neutral'} size="sm">
              Docker: {run.infrastructure_verification?.status || 'UNAVAILABLE'}
            </Badge>
          </div>
        </div>
      </div>

      {/* The Two Distinct Result Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Panel A: AI Behavior Evaluation */}
        <AIEvaluationPanel
          evaluation={run.ai_evaluation}
          testName={run.test_name}
          testId={run.test_id}
          targetMode={run.target_mode}
          mockBehavior={run.mock_behavior}
        />

        {/* Panel B: Docker Infrastructure Verification */}
        <InfrastructureVerificationPanel
          infrastructure={run.infrastructure_verification}
          runId={run.run_id}
          onChecksUpdated={refreshRun}
        />
      </div>
    </div>
  );
};
