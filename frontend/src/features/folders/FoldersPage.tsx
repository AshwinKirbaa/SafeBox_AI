import React, { useState } from 'react';
import { useVault } from '@/lib/vaultContext';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { 
  FolderPlus, 
  Folder as FolderIcon, 
  Edit2, 
  Trash2, 
  Tag as TagIcon, 
  Plus, 
  FileText,
  FolderTree,
  ChevronRight
} from 'lucide-react';

interface FoldersPageProps {
  onNavigateToFilesWithFolder?: (folderId: string) => void;
}

export const FoldersPage: React.FC<FoldersPageProps> = ({ onNavigateToFilesWithFolder }) => {
  const { folders, files, tags, createFolder, renameFolder, deleteFolder } = useVault();
  const { success, warn } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim(), selectedParentId);
    setNewFolderName('');
    setIsCreateOpen(false);
  };

  const handleSaveRename = async () => {
    if (editingFolderId && editName.trim()) {
      await renameFolder(editingFolderId, editName.trim());
      setEditingFolderId(null);
    }
  };

  const folderToDelete = folders.find((f) => f.id === deleteFolderId);

  return (
    <div className="space-y-8 animate-in fade-in select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[rgba(148,163,184,0.12)] gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-heading text-white tracking-tight">
            Folders & Tags
          </h1>
          <p className="text-xs sm:text-sm text-[#9AA6BD] mt-1 font-mono">
            Organize sensitive files across nested folder hierarchies (Max depth 5)
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="shadow-[0_0_15px_rgba(34,211,238,0.25)]"
        >
          <FolderPlus className="w-4 h-4 mr-1.5" /> Create Folder
        </Button>
      </div>

      {/* Folders List */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-accent-cyan" /> Vault Directories
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map((folder) => {
            const fileCount = files.filter((f) => f.folder_id === folder.id).length;
            const isEditing = editingFolderId === folder.id;

            return (
              <div
                key={folder.id}
                className="p-5 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-3 top-light-border hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-input bg-[#121826] border border-cyan-500/30 flex items-center justify-center text-accent-cyan">
                    <FolderIcon className="w-5 h-5" />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingFolderId(folder.id);
                        setEditName(folder.name);
                      }}
                      className="text-slate-400 hover:text-white p-1 rounded"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteFolderId(folder.id)}
                      className="text-slate-400 hover:text-rose-400 p-1 rounded"
                      title="Delete Folder"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  {isEditing ? (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="bg-[#121826] border border-cyan-500 text-white text-xs font-mono px-2 py-1 rounded w-full focus:outline-none"
                      />
                      <Button variant="primary" size="sm" onClick={handleSaveRename}>Save</Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingFolderId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <h3 className="text-base font-bold font-heading text-white truncate">
                      {folder.name}
                    </h3>
                  )}
                  <span className="text-xs font-mono text-[#9AA6BD] mt-1 block">
                    {fileCount} {fileCount === 1 ? 'file' : 'files'} stored
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-[#9AA6BD]">
                  <span>Created {new Date(folder.created_at).toLocaleDateString()}</span>
                  <span className="text-accent-cyan flex items-center gap-1 cursor-pointer hover:underline">
                    Browse <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Tags Section */}
      <section className="space-y-4 pt-4 border-t border-[rgba(148,163,184,0.12)]">
        <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
          <TagIcon className="w-5 h-5 text-accent-blue" /> Vault Classification Tags
        </h2>

        <div className="flex flex-wrap gap-3">
          {tags.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1022] border border-[rgba(148,163,184,0.2)] text-xs font-mono text-white"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
              <span>{t.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Create Folder Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#0A1022] border border-slate-700 rounded-card p-6 space-y-4">
            <h3 className="text-base font-bold font-heading text-white">Create New Folder</h3>
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Tax Records 2026"
                className="w-full bg-[#121826] border border-slate-700 focus:border-cyan-500 rounded-input p-2.5 text-xs text-white font-mono focus:outline-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={handleCreate}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal */}
      <ConfirmDialog
        isOpen={!!deleteFolderId}
        onClose={() => setDeleteFolderId(null)}
        onConfirm={async () => {
          if (deleteFolderId) await deleteFolder(deleteFolderId);
          setDeleteFolderId(null);
        }}
        title="Delete Folder?"
        description={`This will delete the folder "${folderToDelete?.name}". All contained files will be safely moved to the root vault.`}
        confirmLabel="Delete Folder"
      />
    </div>
  );
};
