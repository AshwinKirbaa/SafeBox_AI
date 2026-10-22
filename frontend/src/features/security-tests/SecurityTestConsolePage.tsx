import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Terminal,
  Play,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Info,
} from 'lucide-react';
import { useSecurityTests } from '@/hooks/useSecurityTests';
import { runSecurityTest } from '@/api/runs';
import { SEVERITY_COLORS } from '@/lib/constants';
import type { TargetMode, MockBehavior } from '@/types/api';

interface SecurityTestConsolePageProps {
  initialSelectedTestId?: string;
  onRunCompleted: (runId: string) => void;
}

export const SecurityTestConsolePage: React.FC<SecurityTestConsolePageProps> = ({
  initialSelectedTestId,
  onRunCompleted,
}) => {
  const { tests, isLoading, error } = useSecurityTests();

  const [selectedTestId, setSelectedTestId] = useState<string>(
    initialSelectedTestId || 'test-prompt-injection-01'
  );
  const [targetMode, setTargetMode] = useState<TargetMode>('mock');
  const [mockBehavior, setMockBehavior] = useState<MockBehavior>('vulnerable');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set(tests.map((t) => t.category));
    return ['all', ...Array.from(set)];
  }, [tests]);

  // Filtered tests
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      const matchesSearch =
        test.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        test.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || test.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [tests, searchQuery, categoryFilter]);

  const activeTest = tests.find((t) => t.id === selectedTestId) || tests[0] || null;

  const handleExecute = async () => {
    if (!activeTest) return;
    try {
      setIsRunning(true);
      setSubmissionError(null);

      const response = await runSecurityTest({
        test_id: activeTest.id,
        target_mode: targetMode,
        mock_behavior: targetMode === 'mock' ? mockBehavior : undefined,
      });

      if (response && response.run_id) {
        onRunCompleted(response.run_id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Evaluation submission failed.';
      setSubmissionError(msg);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="p-5 rounded-2xl bg-[#0d1424]/90 border border-[#1f2e52] cyber-top-light flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-sm shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              <Terminal className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-100">
              Security Evaluation Launchpad
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Choose an adversarial threat scenario and configure runtime isolation boundaries.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-[#090e1c]/80 px-3 py-1.5 rounded-xl border border-[#1b2848]">
          <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
          <span>Active Test Catalog: <strong className="text-cyan-300">{tests.length} Suites</strong></span>
        </div>
      </div>

      {/* Main Console Layout: Left Test Catalog, Right Config & Launch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Test Catalog List */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search security tests by name, ID, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#090e1c] border border-[#1b2848] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500 shrink-0" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[#090e1c] border border-[#1b2848] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Test Cards List */}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="p-6 rounded-xl bg-red-950/30 border border-red-800 text-center text-xs text-red-300">
              {error}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="p-8 rounded-xl bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400 font-mono">
              No matching security tests found for your criteria.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTests.map((test) => {
                const isSelected = selectedTestId === test.id;
                const severityStyle =
                  SEVERITY_COLORS[test.severity] || SEVERITY_COLORS.medium;

                return (
                  <div
                    key={test.id}
                    onClick={() => setSelectedTestId(test.id)}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 shadow-[0_0_24px_-4px_rgba(0,240,255,0.35)] cyber-top-light transform -translate-y-0.5'
                        : 'bg-[#090e1c]/80 border-[#1b2848] hover:border-slate-500 hover-3d-lift hover:bg-[#0c1326]'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-slate-100">{test.name}</h3>
                          <span
                            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border ${severityStyle.bg} ${severityStyle.text} ${severityStyle.border}`}
                          >
                            {test.severity}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-cyan-400/80 mt-0.5 block">
                          {test.id}
                        </span>
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60">
                        {test.category}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                      {test.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Test Configuration & Execution Panel */}
        <div className="lg:col-span-5 space-y-4 sticky top-20">
          <Card
            headerSlot={
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">Execution Parameters</h3>
              </div>
            }
          >
            {activeTest ? (
              <div className="space-y-5">
                {/* Selected Test Summary */}
                <div className="p-3 rounded-xl bg-[#090e1c] border border-[#1b2848] cyber-top-light">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-0.5">
                    Target Evaluation
                  </span>
                  <div className="text-xs font-bold text-slate-200">{activeTest.name}</div>
                  <div className="text-[11px] font-mono text-cyan-400">{activeTest.id}</div>
                </div>

                {/* Target Mode Selection */}
                <div>
                  <label className="text-xs font-mono uppercase text-slate-300 block font-semibold mb-2">
                    Target Execution Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTargetMode('mock')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        targetMode === 'mock'
                          ? 'bg-cyan-950/50 border-cyan-400 text-cyan-200 shadow-[0_0_18px_-3px_rgba(0,240,255,0.4)] cyber-top-light'
                          : 'bg-[#090e1c] border-[#1b2848] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold">Mock Sandbox</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                        Simulated LLM behavior
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetMode('container')}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        targetMode === 'container'
                          ? 'bg-cyan-950/50 border-cyan-400 text-cyan-200 shadow-[0_0_18px_-3px_rgba(0,240,255,0.4)] cyber-top-light'
                          : 'bg-[#090e1c] border-[#1b2848] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      <div className="text-xs font-bold">Docker Container</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                        Live isolated worker
                      </div>
                    </button>
                  </div>
                </div>

                {/* Mock Behavior (if mock mode) */}
                {targetMode === 'mock' && (
                  <div>
                    <label className="text-xs font-mono uppercase text-slate-300 block font-semibold mb-2">
                      Simulated Target Safety State
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMockBehavior('safe')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          mockBehavior === 'safe'
                            ? 'bg-emerald-950/50 border-emerald-400 text-emerald-200 shadow-[0_0_18px_-3px_rgba(16,185,129,0.35)] cyber-top-light'
                            : 'bg-[#090e1c] border-[#1b2848] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Safe Target</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                          Expected AI PASS outcome
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMockBehavior('vulnerable')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          mockBehavior === 'vulnerable'
                            ? 'bg-rose-950/50 border-rose-400 text-rose-200 shadow-[0_0_18px_-3px_rgba(244,63,94,0.35)] cyber-top-light'
                            : 'bg-[#090e1c] border-[#1b2848] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Vulnerable</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-sans">
                          Expected AI FAIL (demo)
                        </div>
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 font-mono">
                      *Note: Mock results evaluate synthetic LLM behaviors for deterministic testing and hackathon demonstration.
                    </p>
                  </div>
                )}

                {/* Container Prerequisite Info */}
                {targetMode === 'container' && (
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800 text-xs text-cyan-300">
                    <div className="flex items-center gap-1.5 font-mono font-bold mb-1">
                      <Info className="w-3.5 h-3.5" />
                      <span>Worker Prerequisites:</span>
                    </div>
                    Container mode dispatches probes to the active Docker daemon worker on the host runner. Ensure Docker daemon is running and has pulled the verification image.
                  </div>
                )}

                {submissionError && (
                  <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300">
                    {submissionError}
                  </div>
                )}

                {/* Submit Action Button */}
                <Button
                  variant="primary"
                  size="lg"
                  className={`w-full transition-all duration-300 font-bold ${
                    isRunning
                      ? 'shadow-[0_0_25px_rgba(0,240,255,0.5)] animate-pulse'
                      : 'shadow-[0_0_20px_-3px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)]'
                  }`}
                  onClick={handleExecute}
                  isLoading={isRunning}
                  leftIcon={<Play className="w-4 h-4 fill-slate-950" />}
                >
                  {isRunning ? 'Executing Security Evaluation...' : 'Run Test Evaluation'}
                </Button>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 py-6">
                Please select a security test from the catalog.
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
