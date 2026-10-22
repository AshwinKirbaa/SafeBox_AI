import React, { useState } from 'react';
import { ContainerSandboxCanvas } from '@/components/3d/ContainerSandboxCanvas';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  Box,
  Shield,
  Info,
  ExternalLink,
} from 'lucide-react';
import { useRuns } from '@/hooks/useRuns';
import { INFRASTRUCTURE_CHECKS_METADATA } from '@/lib/constants';
import type { InfrastructureCheckResult } from '@/types/api';

export const InfrastructureSandboxPage: React.FC = () => {
  const { runs } = useRuns();
  const latestRun = runs[0] || null;

  const checks: InfrastructureCheckResult[] =
    latestRun?.infrastructure_verification?.checks || [];
  const status = latestRun?.infrastructure_verification?.status || 'PASS';

  const [selectedCheck, setSelectedCheck] = useState<InfrastructureCheckResult | null>(null);

  const passedCount = checks.filter((c) => c.status === 'PASS').length;
  const failedCount = checks.filter((c) => c.status === 'FAIL').length;

  return (
    <div className="space-y-6">
      {/* 3D Container Header & Scene */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7">
          <ContainerSandboxCanvas
            status={status}
            checks={checks}
            className="h-80 sm:h-96 w-full"
          />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="p-6 rounded-2xl bg-[#0d1424]/90 border border-[#1f2e52] cyber-top-light backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]">
                <Box className="w-4 h-4" />
              </span>
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Docker Isolation Boundary
              </span>
            </div>

            <h2 className="text-xl font-bold text-slate-100 tracking-tight">
              3D Sandbox Containment Kernel
            </h2>

            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Visualizes the containment perimeter enforcing untrusted AI workload execution. Verifies host protection across filesystem flags, namespace separation, dropped capabilities, and network boundaries.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-[#090e1c] border border-[#1b2848] cyber-top-light">
                <span className="text-slate-500 block">Passing Checks</span>
                <span className="text-lg font-bold text-emerald-400">{passedCount}/7</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[#090e1c] border border-[#1b2848] cyber-top-light">
                <span className="text-slate-500 block">Containment Failures</span>
                <span className="text-lg font-bold text-rose-400">{failedCount}</span>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#090e1c]/80 border border-[#1b2848] text-xs text-slate-400 flex items-start gap-3 backdrop-blur-sm">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Telemetry reflects authoritative audit probes collected during test execution. Click any check below to inspect low-level verification telemetry.
            </p>
          </div>
        </div>
      </div>

      {/* The 7 Canonical Checks Interactive Grid */}
      <Card
        headerSlot={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100">
                Isolation Controls Architecture (7 Known Checks)
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              Worker Engine: Docker Linux Namespace Remap
            </span>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checks.map((check) => {
            const meta = INFRASTRUCTURE_CHECKS_METADATA[check.id] || {
              label: check.label,
              description: check.explanation,
              impact: 'Security boundary enforcement',
            };
            const isPass = check.status === 'PASS';
            const isFail = check.status === 'FAIL';

            return (
              <div
                key={check.id}
                onClick={() => setSelectedCheck(check)}
                className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between hover-3d-lift relative overflow-hidden ${
                  isFail
                    ? 'bg-rose-950/20 border-rose-800/80 hover:border-rose-500 shadow-[0_0_15px_-4px_rgba(244,63,94,0.2)]'
                    : isPass
                    ? 'bg-[#090e1c] border-[#1b2848] hover:border-cyan-700/80 hover:shadow-[0_0_20px_-4px_rgba(0,240,255,0.25)] cyber-top-light'
                    : 'bg-slate-900/30 border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-cyan-400/90 font-semibold truncate">
                      {check.id}
                    </span>
                    <Badge variant={isPass ? 'pass' : isFail ? 'fail' : 'neutral'} size="sm">
                      {check.status}
                    </Badge>
                  </div>

                  <h4 className="text-sm font-bold text-slate-100">{check.label}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                    {meta.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#1b2848] flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>View Telemetry</span>
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Check Telemetry Modal */}
      {selectedCheck && (
        <Modal
          isOpen={Boolean(selectedCheck)}
          onClose={() => setSelectedCheck(null)}
          title={`Check Audit: ${selectedCheck.label}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-400">{selectedCheck.id}</span>
              <Badge variant={selectedCheck.status === 'PASS' ? 'pass' : 'fail'}>
                {selectedCheck.status}
              </Badge>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090e1c] border border-[#1b2848]">
              <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-semibold">
                Description & Audit Intent
              </span>
              <p className="text-xs text-slate-200 leading-relaxed">
                {INFRASTRUCTURE_CHECKS_METADATA[selectedCheck.id]?.description || selectedCheck.explanation}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b2848]">
                <span className="text-[10px] font-mono uppercase text-cyan-400 block mb-1 font-semibold">
                  Expected Policy
                </span>
                <p className="text-xs font-mono text-slate-300">
                  {selectedCheck.expected || 'Enforced by default'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b2848]">
                <span className="text-[10px] font-mono uppercase text-amber-400 block mb-1 font-semibold">
                  Observed Telemetry
                </span>
                <p className="text-xs font-mono text-slate-300">
                  {selectedCheck.observed || 'Verified by probe'}
                </p>
              </div>
            </div>

            {selectedCheck.evidence && (
              <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b2848]">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1 font-semibold">
                  Evidence Telemetry Probe
                </span>
                <code className="text-xs font-mono text-cyan-300 block bg-[#050811] p-2 rounded border border-[#16233f] break-all">
                  {selectedCheck.evidence}
                </code>
              </div>
            )}

            {selectedCheck.limitations && (
              <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b2848] text-xs text-slate-400">
                <span className="text-[10px] font-mono uppercase text-amber-500 block mb-1 font-semibold">
                  Isolation Audit Scope
                </span>
                <p>{selectedCheck.limitations}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedCheck(null)}>
                Close Audit Detail
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
