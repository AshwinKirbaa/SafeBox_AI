import React, { useState } from 'react';
import { VaultFile } from '@/types/vault';
import { useVault } from '@/lib/vaultContext';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Trash2, 
  FolderInput, 
  Tag as TagIcon, 
  Edit3, 
  AlertTriangle, 
  FileText, 
  Clock, 
  HardDrive, 
  Sparkles, 
  Lock,
  Cpu,
  Flame,
  Bug
} from 'lucide-react';

interface FileDetailDrawerProps {
  file: VaultFile | null;
  onClose: () => void;
  onSelectFolder: (folderId: string | null) => void;
}

export const FileDetailDrawer: React.FC<FileDetailDrawerProps> = ({ file, onClose, onSelectFolder }) => {
  const { 
    analyses, 
    verifyFileIntegrity, 
    simulateTamperFile, 
    deleteFile, 
    renameFile, 
    moveFile, 
    tagFile, 
    reScanFile, 
    getDownloadUrl, 
    folders, 
    tags: allAvailableTags,
    isScannerConfigured
  } = useVault();

  const { success, error, warn, info } = useToast();

  const [activeTab, setActiveTab] = useState<'details' | 'scanner' | 'ai' | 'activity'>('details');
  const [copiedHash, setCopiedHash] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [isTagOpen, setIsTagOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRiskConfirmOpen, setIsRiskConfirmOpen] = useState(false);
  const [signedDownloadTimer, setSignedDownloadTimer] = useState<number | null>(null);

  if (!file) return null;

  const fileAnalysis = analyses.find((a) => a.file_id === file.id);
  const currentFolder = folders.find((f) => f.id === file.folder_id);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(file.sha256);
    setCopiedHash(true);
    success('Hash Copied', 'SHA-256 copied to clipboard.');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleVerifyIntegrity = async () => {
    setIsVerifying(true);
    await verifyFileIntegrity(file.id);
    setIsVerifying(false);
  };

  const handleStartRename = () => {
    setNewDisplayName(file.display_name);
    setIsRenaming(true);
  };

  const handleSaveRename = async () => {
    if (newDisplayName.trim()) {
      await renameFile(file.id, newDisplayName.trim());
      setIsRenaming(false);
    }
  };

  const handleDownload = (confirmRisk = false) => {
    if (file.status === 'flagged' && !confirmRisk) {
      setIsRiskConfirmOpen(true);
      return;
    }

    const res = getDownloadUrl(file.id, confirmRisk);
    if (res) {
      success('Signed URL Generated', `60-second time-limited link created.`);
      setSignedDownloadTimer(60);
      const interval = setInterval(() => {
        setSignedDownloadTimer((t) => {
          if (t === null || t <= 1) {
            clearInterval(interval);
            return null;
          }
          return t - 1;
        });
      }, 1000);
    }
  };

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full max-w-xl bg-[#0A1022] border-l border-[rgba(148,163,184,0.2)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 select-none top-light-border"
      role="dialog"
      aria-modal="true"
    >
      {/* Top Header */}
      <div className="p-5 border-b border-[rgba(148,163,184,0.14)] bg-[#05070D]/80 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 truncate">
          <div className="w-10 h-10 rounded-input bg-[#121826] border border-cyan-500/30 flex items-center justify-center text-accent-cyan flex-shrink-0 mt-0.5">
            <FileText className="w-5 h-5" />
          </div>
          <div className="truncate">
            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="bg-[#121826] border border-cyan-500 text-white text-sm font-mono px-2 py-1 rounded focus:outline-none"
                  autoFocus
                />
                <Button variant="primary" size="sm" onClick={handleSaveRename}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setIsRenaming(false)}>Cancel</Button>
              </div>
            ) : (
              <h2 className="text-base font-bold font-heading text-white truncate flex items-center gap-2">
                <span className="truncate">{file.display_name}</span>
                <button
                  onClick={handleStartRename}
                  className="text-slate-400 hover:text-cyan-400 p-1"
                  title="Rename file"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1">
              <SeverityBadge
                severity={file.status === 'flagged' ? 'medium' : file.status === 'blocked' ? 'critical' : 'none'}
                size="sm"
              />
              <span className="text-xs font-mono text-[#9AA6BD]">
                {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB • .{file.extension.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 transition-colors"
          aria-label="Close drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center px-5 border-b border-[rgba(148,163,184,0.12)] bg-[#0A1022] text-xs font-mono">
        <button
          onClick={() => setActiveTab('details')}
          className={`py-3 px-3 border-b-2 transition-colors ${
            activeTab === 'details' ? 'border-accent-cyan text-accent-cyan font-bold' : 'border-transparent text-[#9AA6BD] hover:text-white'
          }`}
        >
          Details & Cryptography
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          className={`py-3 px-3 border-b-2 transition-colors ${
            activeTab === 'scanner' ? 'border-accent-cyan text-accent-cyan font-bold' : 'border-transparent text-[#9AA6BD] hover:text-white'
          }`}
        >
          Scanner Verdicts
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'ai' ? 'border-accent-cyan text-accent-cyan font-bold' : 'border-transparent text-[#9AA6BD] hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-accent-cyan" />
          AI Advisory
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6">
        {/* Tab 1: Details & Cryptography */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* SHA-256 Cryptographic Hash Box */}
            <div className="p-4 rounded-card bg-[#121826] border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-[#9AA6BD]">
                <span className="flex items-center gap-1 text-accent-cyan">
                  <ShieldCheck className="w-3.5 h-3.5" /> SHA-256 Cryptographic Hash
                </span>
                <span className="text-[10px] text-slate-500">W3C WebCrypto Digest</span>
              </div>
              <div className="p-2.5 rounded bg-[#0A1022] border border-slate-800 font-mono text-xs text-white break-all flex items-center justify-between gap-2">
                <span>{file.sha256}</span>
                <button
                  onClick={handleCopyHash}
                  className="text-slate-400 hover:text-cyan-400 p-1 flex-shrink-0"
                  title="Copy SHA-256 hash"
                >
                  {copiedHash ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Cryptographic Integrity Status Card */}
            <div className="p-4 rounded-card bg-[#121826] border border-[rgba(148,163,184,0.12)] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold font-heading text-white">Integrity Re-Verification</h4>
                  <span className="text-xs font-mono text-[#9AA6BD]">
                    Last checked: {file.last_integrity_check_at ? new Date(file.last_integrity_check_at).toLocaleString() : 'Unchecked'}
                  </span>
                </div>
                <div className="text-right">
                  {file.integrity_status === 'verified' && (
                    <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-4 h-4" /> VERIFIED MATCH
                    </span>
                  )}
                  {file.integrity_status === 'mismatch' && (
                    <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1 animate-pulse">
                      <Flame className="w-4 h-4" /> TAMPER MISMATCH
                    </span>
                  )}
                  {file.integrity_status === 'unchecked' && (
                    <span className="text-xs font-mono font-bold text-amber-400">
                      UNCHECKED
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleVerifyIntegrity}
                  isLoading={isVerifying}
                  className="flex-1"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Verify Now
                </Button>

                {/* Secret Tamper Simulation Toggle for Demonstrations */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => simulateTamperFile(file.id)}
                  className={`text-[11px] font-mono ${file.is_simulated_tampered ? 'text-rose-400 bg-rose-950/40' : 'text-slate-400'}`}
                  title="Simulate bit drift / storage tampering to test alert handling"
                >
                  <Bug className="w-3.5 h-3.5 mr-1" />
                  {file.is_simulated_tampered ? 'Tampered: ON' : 'Test Drift'}
                </Button>
              </div>
            </div>

            {/* Storage Metadata */}
            <div className="p-4 rounded-card bg-[#121826] border border-[rgba(148,163,184,0.12)] space-y-2.5 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-[#9AA6BD]">Isolated Vault Path:</span>
                <span className="text-white font-mono">{file.storage_path}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-[#9AA6BD]">MIME Claimed:</span>
                <span className="text-white font-mono">{file.mime_type}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-[#9AA6BD]">Folder:</span>
                <span className="text-accent-cyan font-mono">{currentFolder ? currentFolder.name : 'Root Vault'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-[#9AA6BD]">Encryption At-Rest:</span>
                <span className="text-emerald-400 font-mono">AES-256 Provider-Managed</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#9AA6BD]">Created:</span>
                <span className="text-white font-mono">{new Date(file.created_at).toLocaleString()}</span>
              </div>
            </div>

            {/* Content Preview Box */}
            {file.content_preview && (
              <div className="p-4 rounded-card bg-[#121826] border border-[rgba(148,163,184,0.12)] space-y-2">
                <span className="text-xs font-mono text-[#9AA6BD] block">Sanitized Text Preview</span>
                <div className="p-3 bg-[#0A1022] rounded border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {file.content_preview}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Scanner Verdicts */}
        {activeTab === 'scanner' && (
          <div className="space-y-4">
            {!isScannerConfigured ? (
              <div className="p-5 rounded-card bg-[#121826] border border-amber-500/40 space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  <h4 className="text-sm font-bold font-heading">Scanner Not Configured</h4>
                </div>
                <p className="text-xs text-[#9AA6BD] leading-relaxed">
                  The external malware scanning engine adapter requires an API secret. Add the secret to your Lovable / Supabase backend:
                </p>
                <div className="p-3 bg-[#0A1022] rounded border border-slate-800 text-xs font-mono text-cyan-300">
                  Secret Name: <strong>VIRUSTOTAL_API_KEY</strong>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Status: UNCONFIGURED. File contents remain strictly inside your private storage.
                </p>
              </div>
            ) : fileAnalysis?.scanner_verdict ? (
              <div className="p-5 rounded-card bg-[#121826] border border-[rgba(148,163,184,0.14)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-accent-cyan" />
                    <h4 className="text-sm font-bold font-heading text-white">
                      {fileAnalysis.scanner_verdict.engine}
                    </h4>
                  </div>
                  <Badge variant="cyan" size="sm">
                    {fileAnalysis.scanner_verdict.engine_version}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded bg-[#0A1022] border border-slate-800">
                    <span className="text-[#9AA6BD] block">Detections:</span>
                    <strong className="text-base font-bold text-white">
                      {fileAnalysis.scanner_verdict.malicious_detections} / {fileAnalysis.scanner_verdict.total_engines} Engines
                    </strong>
                  </div>
                  <div className="p-3 rounded bg-[#0A1022] border border-slate-800">
                    <span className="text-[#9AA6BD] block">Raw Verdict:</span>
                    <strong className="text-base font-bold text-emerald-400">
                      {fileAnalysis.scanner_verdict.raw_verdict}
                    </strong>
                  </div>
                </div>

                <div className="p-3 bg-[#0A1022] rounded border border-slate-800 text-xs font-mono text-slate-400 space-y-1">
                  <div>Scan Mode: SHA-256 Hash Lookup (Zero Byte Upload)</div>
                  <div>Timestamp: {new Date(fileAnalysis.scanner_verdict.scan_timestamp).toLocaleString()}</div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed font-mono">
                  Honesty guarantee: Clean results signify only that known signatures evaluated returned negative.
                </p>
              </div>
            ) : (
              <div className="text-center py-8 text-xs font-mono text-[#9AA6BD]">
                Scan report pending completion.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: AI Advisory */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            {fileAnalysis?.ai_report ? (
              <div className="p-5 rounded-card bg-[#121826] border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-accent-cyan" />
                    <h4 className="text-sm font-bold font-heading text-white">Advisory Security Analyst</h4>
                  </div>
                  <Badge variant="cyan" size="sm">Advisory Only</Badge>
                </div>

                {/* Structured JSON Schema Representation */}
                <div className="p-3 bg-cyan-950/40 rounded border border-cyan-500/30 text-xs text-cyan-200">
                  <strong className="block text-accent-cyan font-mono uppercase tracking-wider mb-1">
                    Headline Summary:
                  </strong>
                  {fileAnalysis.ai_report.headline}
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#9AA6BD] block uppercase tracking-wider">
                    Plain-Language Explanation
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {fileAnalysis.ai_report.plain_explanation}
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-mono text-[#9AA6BD] block uppercase tracking-wider">
                    Recommended Actions
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300 font-sans list-disc list-inside">
                    {fileAnalysis.ai_report.recommended_actions.map((act, i) => (
                      <li key={i}>{act}</li>
                    ))}
                  </ul>
                </div>

                {/* Mandatory PDF SPEC Disclaimer */}
                <div className="p-3 bg-[#0A1022] rounded border border-amber-500/30 text-[11px] font-mono text-amber-300 italic">
                  {fileAnalysis.ai_report.disclaimer}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs font-mono text-[#9AA6BD]">
                No AI advisory report generated for this file yet.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Drawer Action Bar */}
      <div className="p-4 border-t border-[rgba(148,163,184,0.14)] bg-[#05070D]/90 flex items-center justify-between gap-3">
        <Button
          variant="danger"
          size="sm"
          onClick={() => setIsDeleteConfirmOpen(true)}
          className="gap-1.5"
        >
          <Trash2 className="w-4 h-4" /> Delete
        </Button>

        <div className="flex items-center gap-2">
          {signedDownloadTimer !== null ? (
            <div className="px-3 py-1.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-xs font-mono text-emerald-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
              <span>Signed URL Active: {signedDownloadTimer}s</span>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDownload(false)}
              className="gap-1.5 shadow-[0_0_15px_rgba(34,211,238,0.2)]"
            >
              <Download className="w-4 h-4" /> Download File
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={async () => {
          await deleteFile(file.id);
          onClose();
        }}
        title="Permanently Delete File?"
        description={`This will permanently purge "${file.display_name}" from your vault storage and cascade across all analysis tables. This operation cannot be undone.`}
        isDestructive
        confirmLabel="Purge File"
      />

      <ConfirmDialog
        isOpen={isRiskConfirmOpen}
        onClose={() => setIsRiskConfirmOpen(false)}
        onConfirm={() => handleDownload(true)}
        title="Download Flagged File?"
        description="This file was marked as FLAGGED by security heuristics. It may contain macro automation or an unextracted container archive."
        warningNote="Do not execute macros or scripts contained inside unless you trust the source completely."
        confirmLabel="I understand the risk, download"
      />
    </div>
  );
};
