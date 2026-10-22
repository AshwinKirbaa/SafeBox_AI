import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Box,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Cpu,
} from 'lucide-react';
import type { InfrastructureVerificationResult } from '@/types/api';
import { triggerInfrastructureChecks } from '@/api/runs';

interface InfrastructureVerificationPanelProps {
  infrastructure?: InfrastructureVerificationResult | null;
  runId: string;
  onChecksUpdated?: () => void;
}

export const InfrastructureVerificationPanel: React.FC<InfrastructureVerificationPanelProps> = ({
  infrastructure,
  runId,
  onChecksUpdated,
}) => {
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);

  const status = infrastructure?.status || 'UNAVAILABLE';
  const checks = infrastructure?.checks || [];

  const isPass = status === 'PASS';
  const isFail = status === 'FAIL';
  const isPending = status === 'PENDING';

  const badgeVariant = isPass ? 'pass' : isFail ? 'fail' : isPending ? 'pending' : 'neutral';

  const handleTriggerChecks = async () => {
    try {
      setIsTriggering(true);
      setTriggerError(null);
      await triggerInfrastructureChecks(runId);
      if (onChecksUpdated) {
        onChecksUpdated();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to trigger infrastructure verification';
      setTriggerError(msg);
    } finally {
      setIsTriggering(false);
    }
  };

  const toggleCheck = (id: string) => {
    setExpandedCheckId(expandedCheckId === id ? null : id);
  };

  const getStatusIcon = (checkStatus: string) => {
    switch (checkStatus) {
      case 'PASS':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'FAIL':
        return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'PENDING':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />;
    }
  };

  return (
    <Card
      glow={isFail ? 'fail' : isPass ? 'pass' : 'none'}
      headerSlot={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-mono text-emerald-400/90 tracking-wider uppercase font-semibold">
                Dimension 2
              </span>
              <h2 className="text-sm font-bold text-slate-100">
                Docker Infrastructure Verification
              </h2>
            </div>
          </div>
          <Badge variant={badgeVariant} size="md">
            Docker: {status}
          </Badge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Verification Meta Summary */}
        <div className="p-3.5 rounded-xl bg-[#090e1c] border border-[#1b2848] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400 block mb-1">
              {infrastructure?.summary || 'No Docker infrastructure checks recorded for this run.'}
            </span>
            <div className="flex items-center gap-4 text-[11px] font-mono text-slate-500">
              {infrastructure?.worker_id && (
                <span>Worker: <strong className="text-slate-300">{infrastructure.worker_id}</strong></span>
              )}
              {infrastructure?.verified_at && (
                <span>Verified: <strong className="text-slate-300">{new Date(infrastructure.verified_at).toLocaleTimeString()}</strong></span>
              )}
            </div>
          </div>

          {/* Trigger Checks Action (if unavailable or on-demand audit) */}
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTriggerChecks}
            isLoading={isTriggering}
            className="shrink-0 text-xs"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Verify 7 Docker Checks</span>
          </Button>
        </div>

        {triggerError && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-300">
            {triggerError}
          </div>
        )}

        {/* The 7 Canonical Checks List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Isolation Boundary Audit ({checks.length}/7 Checks)
            </h3>
            <span className="text-[11px] font-mono text-slate-500">
              Click check to inspect audit telemetry
            </span>
          </div>

          {checks.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
              Infrastructure checks not yet executed. Click <strong>Verify 7 Docker Checks</strong> above to initiate container verification.
            </div>
          ) : (
            <div className="space-y-2">
              {checks.map((check) => {
                const isExpanded = expandedCheckId === check.id;
                const checkPass = check.status === 'PASS';
                const checkFail = check.status === 'FAIL';

                return (
                  <div
                    key={check.id}
                    className={`rounded-xl border transition-all ${
                      checkFail
                        ? 'border-rose-900/80 bg-rose-950/20'
                        : checkPass
                        ? 'border-[#1b2848] bg-[#090e1c] hover:border-cyan-800/60'
                        : 'border-slate-800 bg-slate-900/30'
                    }`}
                  >
                    <div
                      className="px-4 py-3 flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleCheck(check.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {getStatusIcon(check.status)}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">
                              {check.label}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {check.id}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-md">
                            {check.explanation}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge
                          variant={
                            checkPass
                              ? 'pass'
                              : checkFail
                              ? 'fail'
                              : check.status === 'PENDING'
                              ? 'pending'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {check.status}
                        </Badge>
                        <button
                          className="p-1 text-slate-500 hover:text-slate-300"
                          aria-label={isExpanded ? 'Collapse check details' : 'Expand check details'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Technical Detail */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-[#1b2848]/60 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-[#060a14]/60">
                        <div className="p-2.5 rounded-lg bg-[#0d1424] border border-[#1a2644]">
                          <span className="text-[10px] font-mono text-cyan-400 block uppercase font-semibold mb-1">
                            Expected Specification
                          </span>
                          <p className="font-mono text-slate-300 text-[11px]">
                            {check.expected || 'Default secure parameter'}
                          </p>
                        </div>

                        <div className="p-2.5 rounded-lg bg-[#0d1424] border border-[#1a2644]">
                          <span className="text-[10px] font-mono text-amber-400 block uppercase font-semibold mb-1">
                            Observed Telemetry
                          </span>
                          <p className="font-mono text-slate-300 text-[11px]">
                            {check.observed || 'Verified by probe'}
                          </p>
                        </div>

                        {check.evidence && (
                          <div className="p-2.5 rounded-lg bg-[#0d1424] border border-[#1a2644] md:col-span-2">
                            <span className="text-[10px] font-mono text-slate-400 block uppercase font-semibold mb-1">
                              Verification Evidence Reference
                            </span>
                            <code className="text-slate-300 font-mono text-[11px] block break-all">
                              {check.evidence}
                            </code>
                          </div>
                        )}

                        {check.limitations && (
                          <div className="p-2.5 rounded-lg bg-[#0d1424] border border-[#1a2644] md:col-span-2 text-slate-400">
                            <span className="text-[10px] font-mono text-amber-500/90 block uppercase font-semibold mb-0.5">
                              Audit Limitations
                            </span>
                            <span className="text-[11px] font-sans">
                              {check.limitations}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Crucial Security Principle Disclaimer */}
        <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-900/40 text-[11px] text-cyan-400/80 leading-relaxed font-sans">
          <strong>Security Principle:</strong> Passing these 7 configured infrastructure checks confirms Docker isolation boundaries were active during this evaluation. It does not certify universal immunity against unmodeled kernel zero-days.
        </div>
      </div>
    </Card>
  );
};
