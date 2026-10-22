import React, { useState } from 'react';
import { useVault } from '@/lib/vaultContext';
import { Button } from '@/components/ui/Button';
import { 
  FileClock, 
  Search, 
  Filter, 
  ShieldCheck, 
  Download, 
  Trash2, 
  Upload, 
  Edit3, 
  KeyRound, 
  Settings 
} from 'lucide-react';

export const ActivityLogPage: React.FC = () => {
  const { activityLogs } = useVault();
  const [actionFilter, setActionFilter] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = activityLogs.filter((log) => {
    const matchesAction = actionFilter === 'all' ? true : log.action === actionFilter;
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.user_agent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(log.metadata).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'file.upload':
        return <span className="text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">file.upload</span>;
      case 'file.download':
        return <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">file.download</span>;
      case 'file.verify':
        return <span className="text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-500/30">file.verify</span>;
      case 'file.delete':
        return <span className="text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-500/30">file.delete</span>;
      case 'auth.login':
        return <span className="text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">auth.login</span>;
      default:
        return <span className="text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">{action}</span>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.12)] gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white tracking-tight">
            Activity Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-[#9AA6BD] mt-1 font-mono">
            Append-only, tamper-evident record of all vault operations • Zero IP addresses stored
          </p>
        </div>

        <div className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-3 py-1.5 rounded-card border border-emerald-500/30 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Immutability Enforced</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-accent-cyan absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search audit trail..."
              className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input pl-9 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-[#121826] border border-slate-700 text-xs text-white font-mono rounded-input px-3 py-1.5 focus:outline-none"
          >
            <option value="all">All Operations</option>
            <option value="file.upload">Uploads (file.upload)</option>
            <option value="file.download">Downloads (file.download)</option>
            <option value="file.verify">Integrity Checks (file.verify)</option>
            <option value="file.delete">Deletions (file.delete)</option>
            <option value="auth.login">Logins (auth.login)</option>
          </select>
        </div>

        <span className="text-xs font-mono text-[#9AA6BD]">
          {filteredLogs.length} immutable entries
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-card border border-[rgba(148,163,184,0.14)] bg-[#0A1022] overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#121826] text-[#9AA6BD] border-b border-slate-800">
            <tr>
              <th className="p-3">TIMESTAMP</th>
              <th className="p-3">ACTION</th>
              <th className="p-3">TARGET</th>
              <th className="p-3">AUDIT METADATA</th>
              <th className="p-3 text-right">AGENT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.map((log) => (
              <tr key={log.id} className="hover:bg-[#121826]/40 transition-colors">
                <td className="p-3 text-slate-300">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="p-3">
                  {getActionBadge(log.action)}
                </td>
                <td className="p-3 text-white font-medium">
                  {log.entity_id}
                </td>
                <td className="p-3 text-slate-400 font-mono max-w-xs truncate">
                  {JSON.stringify(log.metadata)}
                </td>
                <td className="p-3 text-right text-slate-500 max-w-[150px] truncate" title={log.user_agent}>
                  {log.user_agent.split(' ')[0] || 'Browser Client'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
