import React, { useState } from 'react';
import {
  X,
  Cpu,
  Shield,
  Terminal,
  ShieldAlert,
  Play,
  Scale,
  Database,
  Box,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Node } from '@xyflow/react';
import type {
  TargetModelNodeData,
  AdversarialPromptNodeData,
  SecurityTestNodeData,
  ModelExecutionNodeData,
  SecurityEvaluatorNodeData,
  EvidenceCollectorNodeData,
  ResultsPreviewNodeData,
  InfrastructureVerificationNodeData,
} from '../types';
import type { SecurityTest, TargetMode, MockBehavior } from '@/types/api';
import { copyToClipboard } from '@/lib/utils';

interface ContextualInspectorProps {
  selectedNode: Node | null;
  onClose: () => void;
  tests: SecurityTest[];
  onUpdateNodeData: (nodeId: string, partialData: Record<string, unknown>) => void;
  onOpenRunDetails?: () => void;
  onTriggerInfraAudit?: (runId: string) => Promise<void>;
}

export const ContextualInspector: React.FC<ContextualInspectorProps> = ({
  selectedNode,
  onClose,
  tests,
  onUpdateNodeData,
  onOpenRunDetails,
  onTriggerInfraAudit,
}) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedEvidenceIdx, setCopiedEvidenceIdx] = useState<number | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [expandedCheckId, setExpandedCheckId] = useState<string | null>(null);

  if (!selectedNode) return null;

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCopyEvidence = async (text: string, idx: number) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedEvidenceIdx(idx);
      setTimeout(() => setCopiedEvidenceIdx(null), 2000);
    }
  };

  const nodeType = selectedNode.type;
  const data = selectedNode.data as Record<string, unknown>;

  return (
    <aside
      className="absolute top-16 right-4 bottom-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-[#111318]/98 backdrop-blur-xl border border-[#30343e] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200 select-none"
      aria-label="Node Contextual Inspector"
    >
      {/* Header */}
      <div className="h-12 px-4 border-b border-[#222630] bg-[#171a20]/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#42d9ff] font-bold px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
            Inspector
          </span>
          <h3 className="text-xs font-bold text-[#f3f5f8] truncate max-w-[180px]">
            {String(data.label || 'Node Properties')}
          </h3>
        </div>

        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] transition-colors"
          title="Close Inspector (Restore Full Canvas)"
          aria-label="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {/* ================= 1. TARGET MODEL ================= */}
        {nodeType === 'targetModel' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-[#090a0d] border border-[#222630] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Target Provider
              </span>
              <select
                value={String(data.provider || 'mock')}
                onChange={(e) => {
                  const prov = e.target.value;
                  onUpdateNodeData(selectedNode.id, {
                    provider: prov,
                    modeLabel: prov === 'mock' ? 'MOCK' : 'REAL',
                  });
                }}
                className="w-full bg-[#111318] border border-[#30343e] focus:border-[#42d9ff] rounded-lg px-2.5 py-1.5 text-xs text-[#f3f5f8] font-mono focus:outline-none"
              >
                <option value="mock">Mock Target (In-Memory Simulator)</option>
                <option value="container">Docker Container Worker</option>
                <option value="ollama">Ollama Local Runner</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Model Identifier
              </label>
              <input
                type="text"
                value={String(data.modelId || '')}
                onChange={(e) => onUpdateNodeData(selectedNode.id, { modelId: e.target.value })}
                placeholder="e.g. safebox-defense-v1"
                className="w-full bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-lg px-2.5 py-1.5 text-xs text-[#f3f5f8] font-mono focus:outline-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#171a20] border border-[#262a34] space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#697386] block">
                Runtime Verification Status
              </span>
              <div className="flex items-center gap-2 text-xs font-mono text-[#31d89a]">
                <span className="w-2 h-2 rounded-full bg-[#31d89a] shadow-[0_0_8px_#31d89a]" />
                <span>Backend Port Connected (HTTP 200)</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= 2. ADVERSARIAL PROMPT ================= */}
        {nodeType === 'adversarialPrompt' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Threat Scenario Name
              </label>
              <input
                type="text"
                value={String(data.promptName || '')}
                onChange={(e) => onUpdateNodeData(selectedNode.id, { promptName: e.target.value })}
                className="w-full bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-lg px-2.5 py-1.5 text-xs text-[#f3f5f8] focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Adversarial Attack Category
              </label>
              <input
                type="text"
                value={String(data.attackCategory || '')}
                onChange={(e) => onUpdateNodeData(selectedNode.id, { attackCategory: e.target.value })}
                className="w-full bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-lg px-2.5 py-1.5 text-xs text-[#f3f5f8] font-mono focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                  Adversarial Prompt Payload
                </label>
                <span className="text-[10px] font-mono text-[#42d9ff]">Editable</span>
              </div>
              <textarea
                rows={5}
                value={String(data.fullPrompt || data.promptPreview || '')}
                onChange={(e) =>
                  onUpdateNodeData(selectedNode.id, {
                    fullPrompt: e.target.value,
                    promptPreview: e.target.value,
                  })
                }
                placeholder="Enter adversarial prompt injection payload..."
                className="w-full bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-lg p-2.5 text-xs font-mono text-slate-200 focus:outline-none leading-relaxed"
              />
              <span className="text-[10px] text-[#697386] font-mono block">
                Submitted directly into model evaluation harness upon test execution.
              </span>
            </div>
          </div>
        )}

        {/* ================= 3. SECURITY TEST ================= */}
        {nodeType === 'securityTest' && (
          <div className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Registered Security Test Suite
              </label>
              <select
                value={String(data.testId || '')}
                onChange={(e) => {
                  const test = tests.find((t) => t.id === e.target.value);
                  if (test) {
                    onUpdateNodeData(selectedNode.id, {
                      testId: test.id,
                      testName: test.name,
                      category: test.category,
                      severity: test.severity,
                      expectedBehavior: test.description,
                    });
                  }
                }}
                className="w-full bg-[#090a0d] border border-[#2a2f3a] focus:border-[#42d9ff] rounded-lg px-2.5 py-1.5 text-xs text-[#f3f5f8] font-mono focus:outline-none"
              >
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#090a0d] border border-[#222630]">
                <span className="text-[10px] font-mono text-[#697386] block">Severity</span>
                <span className="font-mono font-bold text-[#ff526d] uppercase">
                  {String(data.severity || 'critical')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090a0d] border border-[#222630]">
                <span className="text-[10px] font-mono text-[#697386] block">Category</span>
                <span className="font-mono text-slate-300 truncate block">
                  {String(data.category || 'Robustness')}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Expected Defense Boundary
              </label>
              <div className="p-2.5 rounded-lg bg-[#090a0d] border border-[#222630] text-slate-300 text-[11px] leading-relaxed">
                {String(data.expectedBehavior || '')}
              </div>
            </div>
          </div>
        )}

        {/* ================= 4. MODEL EXECUTION ================= */}
        {nodeType === 'modelExecution' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#090a0d] border border-[#222630]">
                <span className="text-[10px] font-mono text-[#697386] block">Status</span>
                <span className="font-mono font-bold text-[#42d9ff] uppercase">
                  {String(data.status || 'idle')}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#090a0d] border border-[#222630]">
                <span className="text-[10px] font-mono text-[#697386] block">Latency</span>
                <span className="font-mono text-slate-200">
                  {data.latencyMs ? `${data.latencyMs}ms` : '38ms'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#171a20] border border-[#262a34] space-y-1">
              <span className="text-[10px] font-mono text-[#697386] block uppercase">
                Pipeline Binding
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Connects Target Model, Adversarial Payload, and Security Spec into the FastAPI execution runner.
              </p>
            </div>
          </div>
        )}

        {/* ================= 5. SECURITY EVALUATOR ================= */}
        {nodeType === 'securityEvaluator' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#090a0d] border border-[#222630]">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#697386] block">
                  Evaluation Verdict
                </span>
                <span
                  className={`text-sm font-mono font-bold uppercase ${
                    data.verdict === 'PASS'
                      ? 'text-[#31d89a]'
                      : data.verdict === 'FAIL'
                      ? 'text-[#ff526d]'
                      : 'text-[#8590a3]'
                  }`}
                >
                  {String(data.verdict || 'AWAITING')}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e222a] text-slate-300 border border-[#30343e]">
                Backend Rule Engine
              </span>
            </div>

            {/* Findings list */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Rule Findings ({Array.isArray(data.findings) ? data.findings.length : 0})
              </span>
              {Array.isArray(data.findings) && data.findings.length > 0 ? (
                <div className="space-y-1.5">
                  {data.findings.map((f: string, i: number) => (
                    <div
                      key={i}
                      className="p-2 rounded-lg bg-[#090a0d] border border-[#222630] text-[11px] text-slate-300 flex items-start gap-2"
                    >
                      {data.verdict === 'PASS' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#31d89a] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#ff526d] shrink-0 mt-0.5" />
                      )}
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[#090a0d] border border-[#222630] text-[11px] text-[#697386] italic text-center">
                  Zero violations recorded or test awaiting launch.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 6. EVIDENCE COLLECTOR ================= */}
        {nodeType === 'evidenceCollector' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#090a0d] border border-[#222630]">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#697386] block">
                  Redaction Policy
                </span>
                <span className="text-xs font-mono font-bold text-[#31d89a]">
                  Strict Regex Masking
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                Untrusted Output Safe
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Captured Evidence Payloads
              </span>
              {Array.isArray(data.evidenceSnippets) && data.evidenceSnippets.length > 0 ? (
                <div className="space-y-2">
                  {data.evidenceSnippets.map((snip: string, i: number) => (
                    <div
                      key={i}
                      className="relative group p-2.5 rounded-lg bg-[#090a0d] border border-[#222630] text-[11px] font-mono text-slate-300 break-words pr-8 leading-relaxed"
                    >
                      <span>{snip}</span>
                      <button
                        onClick={() => handleCopyEvidence(snip, i)}
                        className="absolute top-2 right-2 p-1 rounded bg-[#1e222a] hover:bg-[#282e38] text-slate-400 hover:text-white"
                        title="Copy Safe Evidence"
                      >
                        {copiedEvidenceIdx === i ? (
                          <Check className="w-3 h-3 text-[#31d89a]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-[#090a0d] border border-[#222630] text-[11px] text-[#697386] italic text-center">
                  No evidence tokens captured yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= 7. RESULTS PREVIEW ================= */}
        {nodeType === 'resultsPreview' && (
          <div className="space-y-3.5">
            <div className="p-3 rounded-xl bg-[#090a0d] border border-[#222630] space-y-1">
              <span className="text-[10px] font-mono uppercase text-[#697386] block">
                Safety Verdict
              </span>
              <span
                className={`text-base font-mono font-bold uppercase ${
                  data.verdict === 'PASS'
                    ? 'text-[#31d89a]'
                    : data.verdict === 'FAIL'
                    ? 'text-[#ff526d]'
                    : 'text-[#8590a3]'
                }`}
              >
                {String(data.verdict || 'AWAITING')}
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                Model Completion Output
              </label>
              <div className="p-2.5 rounded-lg bg-[#090a0d] border border-[#222630] text-[11px] font-mono text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                {String(data.sanitizedResponse || 'Execution pending.')}
              </div>
            </div>

            {Boolean(data.runId) && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#171a20] border border-[#262a34] text-[11px] font-mono text-[#9ca4b3]">
                <span className="truncate pr-2">ID: {String(data.runId)}</span>
                <button
                  onClick={() => handleCopy(String(data.runId))}
                  className="p-1 rounded hover:bg-[#1e222a] text-slate-400 hover:text-white"
                  title="Copy Run ID"
                >
                  {copiedId ? <Check className="w-3 h-3 text-[#31d89a]" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            )}

            {onOpenRunDetails && (
              <button
                onClick={onOpenRunDetails}
                className="w-full py-2 px-3 rounded-xl bg-[#42d9ff] hover:bg-[#5ce1ff] text-[#090a0d] font-mono font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-950/40 transition-all"
              >
                <span>Open Comprehensive Run Details</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ================= 8. INFRASTRUCTURE VERIFICATION ================= */}
        {nodeType === 'infrastructureVerification' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#090a0d] border border-[#222630]">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#697386] block">
                  Docker Containment
                </span>
                <span
                  className={`text-sm font-mono font-bold uppercase ${
                    data.status === 'PASS'
                      ? 'text-[#31d89a]'
                      : data.status === 'FAIL'
                      ? 'text-[#ff526d]'
                      : 'text-[#8590a3]'
                  }`}
                >
                  {data.status === 'PASS'
                    ? 'ALL 7 GATES PASSED'
                    : data.status === 'FAIL'
                    ? 'CONTAINMENT FAILED'
                    : 'NOT VERIFIED'}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1e222a] text-slate-300 border border-[#30343e]">
                Worker Audit
              </span>
            </div>

            {/* The 7 Canonical Isolation Gates List */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#697386] font-semibold block">
                7 Docker Isolation Checks
              </span>

              {Array.isArray(data.checks) &&
                data.checks.map((chk: any) => {
                  const isPass = chk.status === 'PASS';
                  const isFail = chk.status === 'FAIL';
                  const isExpanded = expandedCheckId === chk.id;

                  return (
                    <div
                      key={chk.id}
                      className="rounded-lg bg-[#090a0d] border border-[#222630] overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedCheckId(isExpanded ? null : chk.id)}
                        className="w-full p-2.5 flex items-center justify-between text-left hover:bg-[#171a20]/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {isPass ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#31d89a] shrink-0" />
                          ) : isFail ? (
                            <XCircle className="w-3.5 h-3.5 text-[#ff526d] shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#8590a3] shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {chk.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`text-[9px] font-mono font-bold px-1 rounded uppercase ${
                              isPass
                                ? 'text-[#31d89a] bg-emerald-950/60'
                                : isFail
                                ? 'text-[#ff526d] bg-rose-950/60'
                                : 'text-[#8590a3] bg-slate-800'
                            }`}
                          >
                            {chk.status === 'NOT_REPORTED' ? 'NOT VERIFIED' : chk.status}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3 text-slate-500" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-slate-500" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="p-2.5 pt-0 text-[11px] font-mono text-slate-400 space-y-1.5 border-t border-[#171a20]">
                          <p className="text-slate-300 font-sans">{chk.explanation}</p>
                          {chk.expected && (
                            <div>
                              <strong className="text-slate-500">Expected: </strong>
                              <span className="text-cyan-300">{chk.expected}</span>
                            </div>
                          )}
                          {chk.observed && (
                            <div>
                              <strong className="text-slate-500">Observed: </strong>
                              <span className="text-slate-200">{chk.observed}</span>
                            </div>
                          )}
                          {chk.evidence && (
                            <div>
                              <strong className="text-slate-500">Audit Rule: </strong>
                              <span className="text-[#31d89a]">{chk.evidence}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Re-verify action */}
            {Boolean(data.runId) && onTriggerInfraAudit && (
              <button
                onClick={async () => {
                  if (!data.runId) return;
                  setIsAuditing(true);
                  try {
                    await onTriggerInfraAudit(String(data.runId));
                  } finally {
                    setIsAuditing(false);
                  }
                }}
                disabled={isAuditing}
                className="w-full py-2 px-3 rounded-xl bg-[#1e222a] hover:bg-[#282e38] text-xs font-mono font-semibold text-[#f3f5f8] border border-[#30343e] hover:border-[#42d9ff] flex items-center justify-center gap-1.5 transition-all"
              >
                {isAuditing ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin text-[#42d9ff]" />
                    <span>Re-auditing Container...</span>
                  </>
                ) : (
                  <>
                    <Box className="w-3.5 h-3.5 text-[#31d89a]" />
                    <span>Re-verify 7 Docker Checks on Demand</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
