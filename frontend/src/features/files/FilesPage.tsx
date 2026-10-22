import React, { useState, useRef } from 'react';
import { useVault } from '@/lib/vaultContext';
import { VaultFile, FileStatus, SeverityLevel } from '@/types/vault';
import { FileDetailDrawer } from './FileDetailDrawer';
import { SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { 
  Upload, 
  Search, 
  Filter, 
  Grid, 
  List, 
  FileText, 
  Folder as FolderIcon, 
  Tag as TagIcon, 
  Trash2, 
  FolderInput, 
  Download, 
  CheckSquare, 
  Square, 
  ChevronDown, 
  ArrowUpDown, 
  X,
  FileCheck2,
  AlertTriangle,
  HardDrive
} from 'lucide-react';

interface FilesPageProps {
  initialSelectedFileId?: string | null;
}

export const FilesPage: React.FC<FilesPageProps> = ({ initialSelectedFileId }) => {
  const { files, folders, tags, uploadFile, deleteFile, moveFile } = useVault();
  const { success, warn, error } = useToast();

  const [selectedFileId, setSelectedFileId] = useState<string | null>(initialSelectedFileId || null);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('all');
  const [sortField, setSortField] = useState<'date' | 'name' | 'size' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-selection state
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedFile = files.find((f) => f.id === selectedFileId) || null;

  // Filter and search pipeline
  const filteredFiles = files.filter((f) => {
    const matchesSearch =
      f.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.sha256.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesFolder = selectedFolderId === 'all' ? true : f.folder_id === selectedFolderId;
    const matchesTag = selectedTag === 'all' ? true : f.tags.includes(selectedTag);
    const matchesStatus = statusFilter === 'all' ? true : f.status === statusFilter;

    return matchesSearch && matchesFolder && matchesTag && matchesStatus;
  });

  // Sorting
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'name') {
      comparison = a.display_name.localeCompare(b.display_name);
    } else if (sortField === 'size') {
      comparison = a.size_bytes - b.size_bytes;
    } else if (sortField === 'status') {
      comparison = a.status.localeCompare(b.status);
    } else {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processSelectedFiles(Array.from(e.target.files));
    }
  };

  const processSelectedFiles = async (fileList: File[]) => {
    setIsUploading(true);
    const folderId = selectedFolderId === 'all' ? null : selectedFolderId;
    for (const file of fileList) {
      await uploadFile(file, folderId);
    }
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Multi-selection helpers
  const handleToggleSelectAll = () => {
    if (selectedFileIds.length === sortedFiles.length) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(sortedFiles.map((f) => f.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    for (const id of selectedFileIds) {
      await deleteFile(id);
    }
    setSelectedFileIds([]);
    setIsBulkDeleteOpen(false);
    success('Bulk Delete Completed', 'Purged selected items from vault.');
  };

  const handleBulkMove = async () => {
    for (const id of selectedFileIds) {
      await moveFile(id, targetMoveFolderId);
    }
    setSelectedFileIds([]);
    setIsBulkMoveOpen(false);
    success('Bulk Move Completed', 'Files moved to target destination.');
  };

  return (
    <div className="space-y-6 animate-in fade-in select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.12)] gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white tracking-tight">
            Vault Files
          </h1>
          <p className="text-xs sm:text-sm text-[#9AA6BD] mt-1 font-mono">
            {files.length} protected objects • Client-side SHA-256 pre-validation
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#121826] p-1 rounded-input border border-slate-700/60">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table' ? 'bg-[#1A2236] text-accent-cyan' : 'text-[#9AA6BD] hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid' ? 'bg-[#1A2236] text-accent-cyan' : 'text-[#9AA6BD] hover:text-white'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="shadow-[0_0_15px_rgba(34,211,238,0.25)]"
          >
            <Upload className="w-4 h-4 mr-1.5" /> Upload File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
        </div>
      </div>

      {/* Upload Dropzone (Collapsible Drag Target) */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-6 rounded-card border-2 border-dashed transition-all cursor-pointer text-center space-y-2 ${
          isDragging
            ? 'border-accent-cyan bg-cyan-950/30 scale-[1.01]'
            : 'border-[rgba(148,163,184,0.18)] bg-[#0A1022]/60 hover:border-cyan-500/50'
        }`}
      >
        <Upload className="w-8 h-8 text-accent-cyan mx-auto" />
        <div className="text-sm font-semibold font-heading text-white">
          {isUploading ? 'Computing Web Crypto SHA-256 & Uploading...' : 'Drag and drop sensitive files here, or click to browse'}
        </div>
        <p className="text-xs text-[#9AA6BD] font-mono">
          Allowed: PDF, PNG, JPG, WEBP, GIF, TXT, MD, CSV, DOCX, XLSX, PPTX, ZIP (Max 25 MB per file)
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[260px]">
            <Search className="w-3.5 h-3.5 text-accent-cyan absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, tag, hash..."
              className="w-full bg-[#121826] border border-slate-700/60 focus:border-cyan-500 rounded-input pl-9 pr-3 py-1.5 text-xs text-white font-mono focus:outline-none"
            />
          </div>

          {/* Folder Filter */}
          <select
            value={selectedFolderId}
            onChange={(e) => setSelectedFolderId(e.target.value)}
            className="bg-[#121826] border border-slate-700/60 text-xs text-white font-mono rounded-input px-3 py-1.5 focus:outline-none"
          >
            <option value="all">All Folders</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#121826] border border-slate-700/60 text-xs text-white font-mono rounded-input px-3 py-1.5 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="ready">Ready (Clean)</option>
            <option value="flagged">Flagged</option>
            <option value="blocked">Blocked</option>
            <option value="scanning">Scanning</option>
          </select>

          {/* Sort By */}
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
            className="bg-[#121826] border border-slate-700/60 text-xs text-white font-mono rounded-input px-3 py-1.5 focus:outline-none"
          >
            <option value="date">Sort: Date Added</option>
            <option value="name">Sort: File Name</option>
            <option value="size">Sort: Size</option>
            <option value="status">Sort: Status</option>
          </select>

          <button
            onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
            className="p-1.5 rounded bg-[#121826] border border-slate-700/60 text-slate-300 hover:text-white"
            title="Toggle Sort Order"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bulk Actions (When Items Selected) */}
        {selectedFileIds.length > 0 && (
          <div className="flex items-center gap-2 bg-[#121826] px-3 py-1.5 rounded-input border border-cyan-500/40">
            <span className="text-xs font-mono text-cyan-300 font-bold">
              {selectedFileIds.length} Selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBulkMoveOpen(true)}
              className="text-xs py-1 h-7"
            >
              <FolderInput className="w-3.5 h-3.5 mr-1" /> Move
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setIsBulkDeleteOpen(true)}
              className="text-xs py-1 h-7"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>

      {/* Files Display: Table View or Grid View */}
      {sortedFiles.length === 0 ? (
        <EmptyState
          title="No files match your query"
          description="Try clearing your search query or filters, or upload a new sensitive document."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedFolderId('all');
            setStatusFilter('all');
          }}
        />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="rounded-card border border-[rgba(148,163,184,0.14)] bg-[#0A1022] overflow-hidden">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#121826] text-[#9AA6BD] border-b border-slate-800">
              <tr>
                <th className="p-3 w-10">
                  <button onClick={handleToggleSelectAll} className="text-slate-400 hover:text-white">
                    {selectedFileIds.length === sortedFiles.length ? (
                      <CheckSquare className="w-4 h-4 text-accent-cyan" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">FILE NAME</th>
                <th className="p-3">SHA-256 SIGNATURE</th>
                <th className="p-3">SIZE</th>
                <th className="p-3">STATUS</th>
                <th className="p-3">INTEGRITY</th>
                <th className="p-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sortedFiles.map((file) => {
                const isSelected = selectedFileIds.includes(file.id);
                return (
                  <tr
                    key={file.id}
                    className={`hover:bg-[#121826]/60 transition-colors cursor-pointer ${
                      selectedFileId === file.id ? 'bg-[#121826] border-l-2 border-accent-cyan' : ''
                    }`}
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleToggleSelect(file.id)} className="text-slate-400 hover:text-white">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-accent-cyan" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>

                    <td className="p-3 font-medium text-white flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-xs">{file.display_name}</span>
                    </td>

                    <td className="p-3 text-slate-400 font-mono">
                      {file.sha256.substring(0, 16)}...
                    </td>

                    <td className="p-3 text-slate-300">
                      {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </td>

                    <td className="p-3">
                      <SeverityBadge
                        severity={file.status === 'flagged' ? 'medium' : file.status === 'blocked' ? 'critical' : 'none'}
                        size="sm"
                      />
                    </td>

                    <td className="p-3 font-bold">
                      {file.integrity_status === 'verified' && (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <FileCheck2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                      {file.integrity_status === 'mismatch' && (
                        <span className="text-rose-400 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" /> Mismatch
                        </span>
                      )}
                      {file.integrity_status === 'unchecked' && (
                        <span className="text-slate-500">Unchecked</span>
                      )}
                    </td>

                    <td className="p-3 text-right">
                      <span className="text-accent-cyan text-xs font-mono hover:underline">
                        Inspect →
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedFiles.map((file) => (
            <div
              key={file.id}
              onClick={() => setSelectedFileId(file.id)}
              className="p-5 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-3 cursor-pointer hover:border-cyan-500/40 transition-all top-light-border"
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-input bg-[#121826] border border-cyan-500/30 flex items-center justify-center text-accent-cyan">
                  <FileText className="w-5 h-5" />
                </div>
                <SeverityBadge
                  severity={file.status === 'flagged' ? 'medium' : file.status === 'blocked' ? 'critical' : 'none'}
                  size="sm"
                />
              </div>

              <div>
                <h4 className="text-sm font-semibold font-heading text-white truncate" title={file.display_name}>
                  {file.display_name}
                </h4>
                <span className="text-[11px] font-mono text-[#9AA6BD] block truncate mt-0.5">
                  {(file.size_bytes / (1024 * 1024)).toFixed(2)} MB • {file.extension.toUpperCase()}
                </span>
              </div>

              <div className="p-2 bg-[#121826] rounded border border-slate-800 text-[10px] font-mono text-slate-400 truncate">
                SHA-256: {file.sha256.substring(0, 20)}...
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400">
                <span>Integrity: {file.integrity_status}</span>
                <span className="text-accent-cyan hover:underline">Details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Detail Drawer Slide-over */}
      {selectedFile && (
        <FileDetailDrawer
          file={selectedFile}
          onClose={() => setSelectedFileId(null)}
          onSelectFolder={(fId) => setSelectedFolderId(fId || 'all')}
        />
      )}

      {/* Bulk Delete Confirm Modal */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Files?"
        description={`This will permanently purge ${selectedFileIds.length} files from your vault storage bucket.`}
        isDestructive
        confirmLabel={`Delete ${selectedFileIds.length} Files`}
      />

      {/* Bulk Move Modal */}
      {isBulkMoveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A1022] border border-slate-700 rounded-card p-6 space-y-4">
            <h3 className="text-base font-bold font-heading text-white">Move {selectedFileIds.length} Files to Folder</h3>
            <select
              value={targetMoveFolderId || ''}
              onChange={(e) => setTargetMoveFolderId(e.target.value || null)}
              className="w-full bg-[#121826] border border-slate-700 text-xs text-white font-mono rounded-input p-2.5 focus:outline-none"
            >
              <option value="">Root Vault</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsBulkMoveOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleBulkMove}>Move Files</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
