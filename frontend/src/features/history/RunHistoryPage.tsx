import React, { useState, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  History,
  Search,
  Filter,
  RotateCw,
  ChevronRight,
} from 'lucide-react';
import { useRuns } from '@/hooks/useRuns';
import { formatDate, formatTimeAgo } from '@/lib/utils';

interface RunHistoryPageProps {
  onSelectRun: (runId: string) => void;
}

export const RunHistoryPage: React.FC<RunHistoryPageProps> = ({ onSelectRun }) => {
  const { runs, isLoading, error, refreshRuns } = useRuns();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ai_pass' | 'ai_fail' | 'infra_fail'>('all');

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        run.run_id.toLowerCase().includes(q) ||
        run.test_name.toLowerCase().includes(q) ||
        run.test_id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (statusFilter === 'ai_pass') return run.ai_evaluation.status === 'PASS';
      if (statusFilter === 'ai_fail') return run.ai_evaluation.status === 'FAIL';
      if (statusFilter === 'infra_fail') return run.infrastructure_verification?.status === 'FAIL';

      return true;
    });
  }, [runs, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="p-5 rounded-2xl bg-[#0d1424]/90 border border-[#1f2e52] cyber-top-light flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-sm shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
              <History className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-slate-100">Audit History & Telemetry Logs</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative chronological records of adversarial evaluations and container verification checks.
          </p>
        </div>

        {/* Polished Cyber Reload History Button */}
        <button
          type="button"
          onClick={refreshRuns}
          disabled={isLoading}
          aria-label="Reload audit history"
          className="relative group flex items-center gap-2.5 px-4 py-2 rounded-xl bg-[#090e1c] hover:bg-[#10192e] border border-cyan-800/60 hover:border-cyan-400 text-xs font-mono text-slate-300 hover:text-cyan-200 shadow-[0_0_15px_-3px_rgba(0,240,255,0.2)] hover:shadow-[0_0_20px_rgba(0,240,255,0.35)] transition-all duration-300 active:scale-95 disabled:opacity-50 select-none overflow-hidden cursor-pointer shrink-0"
        >
          {/* Top specular highlight shimmer */}
          <span className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

          {/* Icon with smooth hover turn & continuous spin on active loading */}
          <RotateCw
            className={`w-3.5 h-3.5 text-cyan-400 transition-all duration-500 ${
              isLoading ? 'animate-spin text-cyan-300' : 'group-hover:rotate-180'
            }`}
          />

          <span className="font-semibold tracking-wider text-[11px] uppercase">
            {isLoading ? 'Reloading...' : 'Reload History'}
          </span>

          {/* Micro cyber LED indicator */}
          <span
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              isLoading
                ? 'bg-cyan-300 animate-ping'
                : 'bg-cyan-500/70 group-hover:bg-cyan-400 group-hover:shadow-[0_0_6px_#00f0ff]'
            }`}
          />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search runs by ID, test name, or threat identifier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#090e1c] border border-[#1b2848] rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#090e1c] border border-[#1b2848] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="all">All Status Combinations</option>
            <option value="ai_pass">AI: PASS</option>
            <option value="ai_fail">AI: FAIL (Vulnerabilities)</option>
            <option value="infra_fail">Docker: FAIL (Breaches)</option>
          </select>
        </div>
      </div>

      {/* Runs Table / Cards */}
      <Card
        headerSlot={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-mono text-slate-400 uppercase font-semibold">
              Evaluation Runs ({filteredRuns.length} Recorded)
            </span>
            <span className="text-xs font-mono text-slate-500">
              Click run to open two-result audit
            </span>
          </div>
        }
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl bg-red-950/30 border border-red-800 text-center text-xs text-red-300">
            {error}
          </div>
        ) : filteredRuns.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/30 border border-slate-800 text-center text-xs text-slate-400 font-mono">
            No evaluation runs match your search or filter.
          </div>
        ) : (
          <div className="divide-y divide-[#1b2848]/60">
            {filteredRuns.map((run) => {
              const aiPass = run.ai_evaluation.status === 'PASS';
              const infraPass = run.infrastructure_verification?.status === 'PASS';
              const infraFail = run.infrastructure_verification?.status === 'FAIL';

              return (
                <div
                  key={run.run_id}
                  onClick={() => onSelectRun(run.run_id)}
                  className="py-3 px-3 hover:bg-[#0c1326] rounded-xl transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer group hover-3d-lift border border-transparent hover:border-[#1f2e52] relative"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {run.test_name}
                      </span>
                      <span className="text-[11px] font-mono text-cyan-400/90 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/60 shadow-[0_0_8px_rgba(0,240,255,0.15)]">
                        {run.run_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 mt-1">
                      <span>Target: <strong className="text-slate-300">{run.target_mode}</strong> {run.mock_behavior ? `(${run.mock_behavior})` : ''}</span>
                      <span>{formatDate(run.created_at)}</span>
                      <span className="text-slate-500">{formatTimeAgo(run.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={aiPass ? 'pass' : 'fail'} size="sm">
                        AI: {run.ai_evaluation.status}
                      </Badge>
                      <Badge variant={infraPass ? 'pass' : infraFail ? 'fail' : 'neutral'} size="sm">
                        Docker: {run.infrastructure_verification?.status || 'UNAVAILABLE'}
                      </Badge>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
