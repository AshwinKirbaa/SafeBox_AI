import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Play,
  RotateCw,
  Clock,
  History,
  ChevronDown,
  CheckCircle2,
  FileText,
  HelpCircle,
  FolderOpen,
  Download,
  Upload,
  PlusCircle,
  LayoutGrid,
  Zap,
} from 'lucide-react';
import type { SecurityTestRunResponse } from '@/types/api';

interface TopToolbarProps {
  workflowName: string;
  isRunning: boolean;
  onRunWorkflow: () => void;
  apiConnected: boolean;
  workerConnected: boolean;
  currentRun: SecurityTestRunResponse | null;
  runHistory: SecurityTestRunResponse[];
  onSelectRun: (run: SecurityTestRunResponse) => void;
  onOpenHistory: () => void;
  onResetLayout: () => void;
  onOpenHelp: () => void;
  onOpenRunDetails: () => void;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  workflowName,
  isRunning,
  onRunWorkflow,
  apiConnected,
  workerConnected,
  currentRun,
  runHistory,
  onSelectRun,
  onOpenHistory,
  onResetLayout,
  onOpenHelp,
  onOpenRunDetails,
}) => {
  const [openMenu, setOpenMenu] = useState<'workflow' | 'edit' | 'help' | 'runs' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportJSON = () => {
    const data = {
      workflow: workflowName,
      timestamp: new Date().toISOString(),
      currentRun: currentRun || null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safebox-workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpenMenu(null);
  };

  return (
    <header
      ref={menuRef}
      className="absolute top-3 left-4 right-4 z-30 h-11 px-3 bg-[#111318]/95 backdrop-blur-md border border-[#30343e] rounded-xl flex items-center justify-between shadow-2xl select-none"
    >
      {/* Left Section: Logo & Menus */}
      <div className="flex items-center gap-3">
        {/* SafeBox AI Symbol */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#262a34]">
          <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-500/80 flex items-center justify-center text-[#42d9ff] shadow-[0_0_8px_rgba(66,217,255,0.3)]">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold font-mono tracking-tight text-[#f3f5f8] hidden sm:inline">
            SafeBox<span className="text-[#42d9ff]">.AI</span>
          </span>
        </div>

        {/* Workflow Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'workflow' ? null : 'workflow')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              openMenu === 'workflow'
                ? 'bg-[#1e222a] text-[#f3f5f8]'
                : 'text-[#9ca4b3] hover:text-[#f3f5f8] hover:bg-[#171a20]'
            }`}
          >
            <span>Workflow</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {openMenu === 'workflow' && (
            <div className="absolute top-8 left-0 w-52 py-1.5 bg-[#171a20] border border-[#30343e] rounded-xl shadow-2xl text-xs z-50">
              <button
                onClick={() => {
                  onResetLayout();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#1e222a] hover:text-[#42d9ff] flex items-center gap-2"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Reset to Default Layout</span>
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#1e222a] hover:text-[#42d9ff] flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Workflow JSON</span>
              </button>
              <div className="my-1 border-t border-[#262a34]" />
              <button
                onClick={() => {
                  onOpenHistory();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#1e222a] hover:text-[#42d9ff] flex items-center gap-2"
              >
                <History className="w-3.5 h-3.5" />
                <span>Browse Run History ({runHistory.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'edit' ? null : 'edit')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              openMenu === 'edit'
                ? 'bg-[#1e222a] text-[#f3f5f8]'
                : 'text-[#9ca4b3] hover:text-[#f3f5f8] hover:bg-[#171a20]'
            }`}
          >
            <span>Edit</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {openMenu === 'edit' && (
            <div className="absolute top-8 left-0 w-48 py-1.5 bg-[#171a20] border border-[#30343e] rounded-xl shadow-2xl text-xs z-50">
              <button
                onClick={() => {
                  onResetLayout();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#1e222a] flex items-center gap-2"
              >
                <span>Auto-Align Pipeline</span>
              </button>
            </div>
          )}
        </div>

        {/* Help Menu */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              openMenu === 'help'
                ? 'bg-[#1e222a] text-[#f3f5f8]'
                : 'text-[#9ca4b3] hover:text-[#f3f5f8] hover:bg-[#171a20]'
            }`}
          >
            <span>Help</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {openMenu === 'help' && (
            <div className="absolute top-8 left-0 w-60 py-1.5 bg-[#171a20] border border-[#30343e] rounded-xl shadow-2xl text-xs z-50">
              <button
                onClick={() => {
                  onOpenHelp();
                  setOpenMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left text-slate-200 hover:bg-[#1e222a] hover:text-[#42d9ff] flex items-center gap-2"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Security Studio Guide</span>
              </button>
              <div className="px-3 py-1.5 text-[11px] font-mono text-slate-400 border-t border-[#262a34]">
                API: FastAPI @ :8000
                <br />
                Docker: 7 Canonical Isolation Gates
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Section: Workflow Name & Quick Run Selector */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#090a0d] border border-[#222630] text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-[#42d9ff] shadow-[0_0_6px_#42d9ff]" />
          <span className="text-[#f3f5f8] font-medium truncate max-w-[200px] sm:max-w-xs">
            {workflowName}
          </span>
        </div>

        {/* Quick Switch to Historical Runs */}
        {runHistory.length > 0 && (
          <div className="relative hidden md:block">
            <button
              onClick={() => setOpenMenu(openMenu === 'runs' ? null : 'runs')}
              className="px-2 py-1 rounded bg-[#171a20] hover:bg-[#1e222a] border border-[#30343e] text-[11px] font-mono text-[#9ca4b3] hover:text-[#f3f5f8] flex items-center gap-1.5 transition-colors"
            >
              <History className="w-3 h-3 text-[#42d9ff]" />
              <span>
                {currentRun ? `Run ${currentRun.run_id.slice(-8)}` : 'Past Runs'}
              </span>
              <ChevronDown className="w-2.5 h-2.5" />
            </button>

            {openMenu === 'runs' && (
              <div className="absolute top-8 right-0 w-72 max-h-64 overflow-y-auto py-1.5 bg-[#171a20] border border-[#30343e] rounded-xl shadow-2xl text-xs z-50">
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-[#697386]">
                  Select Historical Run to Load
                </div>
                {runHistory.map((run) => (
                  <button
                    key={run.run_id}
                    onClick={() => {
                      onSelectRun(run);
                      setOpenMenu(null);
                    }}
                    className={`w-full px-3 py-1.5 text-left hover:bg-[#1e222a] flex items-center justify-between font-mono text-xs ${
                      currentRun?.run_id === run.run_id
                        ? 'bg-[#1e222a] text-[#42d9ff]'
                        : 'text-slate-300'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="block truncate font-semibold">{run.test_name}</span>
                      <span className="text-[10px] text-slate-500">{run.run_id}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        run.ai_evaluation.status === 'PASS'
                          ? 'bg-emerald-950 text-[#31d89a]'
                          : 'bg-rose-950 text-[#ff526d]'
                      }`}
                    >
                      {run.ai_evaluation.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Section: System Status & Run Workflow Control */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live System Health Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#090a0d] border border-[#222630] text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              apiConnected
                ? 'bg-[#31d89a] shadow-[0_0_8px_#31d89a]'
                : 'bg-[#ff526d] shadow-[0_0_8px_#ff526d]'
            }`}
          />
          <span className="text-slate-300">
            {apiConnected ? 'API Online' : 'Connecting...'}
          </span>
          <span className="text-[#697386]">|</span>
          <span className="text-slate-400">
            {workerConnected ? 'Docker Ready' : 'Sandbox Ready'}
          </span>
        </div>

        {/* History drawer button */}
        <button
          onClick={onOpenHistory}
          className="p-1.5 rounded-lg bg-[#171a20] hover:bg-[#1e222a] text-[#9ca4b3] hover:text-[#f3f5f8] border border-[#30343e] transition-colors relative"
          title="Open Run History"
        >
          <History className="w-3.5 h-3.5" />
          {runHistory.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#42d9ff] text-[#090a0d] font-mono text-[9px] font-bold flex items-center justify-center">
              {runHistory.length}
            </span>
          )}
        </button>

        {/* View Full Run Details (if run exists) */}
        {currentRun && (
          <button
            onClick={onOpenRunDetails}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e222a] hover:bg-[#282e38] text-xs font-mono text-[#f3f5f8] border border-[#30343e] transition-colors"
          >
            <FileText className="w-3 h-3 text-[#42d9ff]" />
            <span>Run Details</span>
          </button>
        )}

        {/* Primary Run Workflow Control */}
        <button
          onClick={onRunWorkflow}
          disabled={isRunning}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wide flex items-center gap-1.5 transition-all shadow-lg ${
            isRunning
              ? 'bg-cyan-950 text-cyan-400 border border-cyan-600 cursor-not-allowed'
              : 'bg-[#42d9ff] hover:bg-[#5ce1ff] text-[#090a0d] shadow-[0_0_16px_rgba(66,217,255,0.4)] active:scale-95'
          }`}
        >
          {isRunning ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Evaluating...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Workflow</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
