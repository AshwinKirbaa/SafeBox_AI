import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, SeverityBadge, SeverityLevel } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { VaultLogo } from '@/components/ui/VaultLogo';
import { Shield, Lock, FileText, CheckCircle, ArrowRight } from 'lucide-react';

export const DesignSystemPage: React.FC = () => {
  const { success, error, warn, info } = useToast();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const colors = [
    { token: '--bg-0', hex: '#05070D', name: 'Page Background', bgClass: 'bg-[#05070D]' },
    { token: '--bg-1', hex: '#0A1022', name: 'Midnight Navy Panels', bgClass: 'bg-[#0A1022]' },
    { token: '--bg-2', hex: '#121826', name: 'Graphite Cards', bgClass: 'bg-[#121826]' },
    { token: '--bg-3', hex: '#1A2236', name: 'Raised Surfaces, Inputs', bgClass: 'bg-[#1A2236]' },
    { token: '--text-1', hex: '#E6EBF5', name: 'Primary Text', bgClass: 'bg-[#E6EBF5]', textDark: true },
    { token: '--text-2', hex: '#9AA6BD', name: 'Secondary Text (4.5:1)', bgClass: 'bg-[#9AA6BD]', textDark: true },
    { token: '--accent', hex: '#22D3EE', name: 'Primary Cyan', bgClass: 'bg-[#22D3EE]', textDark: true },
    { token: '--accent-2', hex: '#3B82F6', name: 'Blue Gradients/Charts', bgClass: 'bg-[#3B82F6]' },
    { token: '--ok', hex: '#34D399', name: 'Verified, Clean', bgClass: 'bg-[#34D399]', textDark: true },
    { token: '--warn', hex: '#FBBF24', name: 'Medium Risk', bgClass: 'bg-[#FBBF24]', textDark: true },
    { token: '--danger', hex: '#F87171', name: 'High Risk', bgClass: 'bg-[#F87171]', textDark: true },
    { token: '--critical', hex: '#FB7185', name: 'Critical Threat', bgClass: 'bg-[#FB7185]', textDark: true },
  ];

  const severities: SeverityLevel[] = ['none', 'info', 'low', 'medium', 'high', 'critical'];

  return (
    <div className="min-h-screen bg-[#05070D] text-[#E6EBF5] p-6 lg:p-12 space-y-12">
      {/* Header */}
      <div className="border-b border-[rgba(148,163,184,0.14)] pb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <VaultLogo size={48} animated />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl lg:text-3xl font-bold font-heading tracking-tight">
                SafeBox AI Design System
              </h1>
              <Badge variant="cyan" size="sm">v1.0 Spec</Badge>
            </div>
            <p className="text-sm text-[#9AA6BD] mt-1 font-mono">
              Tokens, Components, Severity Semantics & Cryptographic Brand Motifs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.location.hash = '#/'}>
            Landing Page
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.location.hash = '#/app'}>
            Launch App Shell
          </Button>
        </div>
      </div>

      {/* Brand Identity: "The Core" */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold font-heading text-white flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-cyan" />
          Brand Identity: "The Core" Hexagonal Vault Mark
        </h2>
        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
            <div className="flex flex-col items-center gap-2 p-4 bg-[#121826] rounded-card">
              <VaultLogo size={32} />
              <span className="text-xs font-mono text-[#9AA6BD]">Small (32px) - Favicon / Nav</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-[#121826] rounded-card">
              <VaultLogo size={48} />
              <span className="text-xs font-mono text-[#9AA6BD]">Medium (48px) - Cards / Modals</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-[#121826] rounded-card">
              <VaultLogo size={72} animated />
              <span className="text-xs font-mono text-[#9AA6BD]">Large (72px) - Hover Animated</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-[#121826] rounded-card">
              <VaultLogo size={96} glow />
              <span className="text-xs font-mono text-[#9AA6BD]">Hero Mark (96px) - Cyan Glow</span>
            </div>
          </div>
        </Card>
      </section>

      {/* Color Tokens */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold font-heading text-white">Color Tokens (Dark Theme Default)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {colors.map((c) => (
            <div key={c.token} className="p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-3">
              <div className={`h-14 rounded-input border border-white/10 ${c.bgClass}`} />
              <div>
                <div className="text-xs font-mono text-accent-cyan">{c.token}</div>
                <div className="text-sm font-semibold font-mono text-[#E6EBF5]">{c.hex}</div>
                <div className="text-xs text-[#9AA6BD] mt-1">{c.name}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Severity Semantics (Always Icon + Text) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold font-heading text-white">Severity Badges (Icon + Text Rule)</h2>
            <p className="text-xs text-[#9AA6BD] mt-0.5">
              Rule: Severity is never conveyed by color alone. Every badge pairs a deterministic icon and text label.
            </p>
          </div>
        </div>

        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)]">
          <div className="flex flex-wrap items-center gap-4">
            {severities.map((sev) => (
              <div key={sev} className="flex flex-col gap-2 items-start p-3 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)]">
                <SeverityBadge severity={sev} size="md" />
                <span className="text-xs font-mono text-[#9AA6BD] capitalize">Level: {sev}</span>
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Buttons & Interactions */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold font-heading text-white">Buttons & Interactive Controls</h2>
        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)]">
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary">
              <Lock className="w-4 h-4 mr-2" /> Primary Cyan
            </Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" /> Outline Button
            </Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Destructive Action</Button>
            <Button variant="primary" isLoading>
              Hashing File...
            </Button>
          </div>
        </Card>
      </section>

      {/* Skeletons & Loading States */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold font-heading text-white">Loading Skeletons (No Layout Shift)</h2>
        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-20 w-full rounded-card" />
        </Card>
      </section>

      {/* Empty & Error States */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold font-heading text-white mb-4">Empty State</h2>
          <EmptyState
            title="No files in this folder"
            description="Drag and drop contracts, invoices, or encrypted archives to begin real-time verification."
            actionLabel="Upload First File"
            onAction={() => info('Upload dialog triggered')}
          />
        </div>
        <div>
          <h2 className="text-xl font-semibold font-heading text-white mb-4">Error State with Retry</h2>
          <ErrorState
            title="Integrity Verification Timeout"
            message="Storage gateway returned 504 Gateway Timeout while streaming file chunks for SHA-256 validation."
            onRetry={() => success('Retried successfully', 'Re-streamed 14.2 MB')}
          />
        </div>
      </section>

      {/* Dialogs and Toasts Trigger */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold font-heading text-white">Confirmation Dialogs & Toasts</h2>
        <Card className="p-6 bg-[#0A1022] border-[rgba(148,163,184,0.14)] space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" onClick={() => setIsConfirmOpen(true)}>
              Test Flagged File Confirmation
            </Button>
            <Button variant="danger" onClick={() => setIsDeleteModalOpen(true)}>
              Test Account Delete ("DELETE" confirmation)
            </Button>
            <Button variant="secondary" onClick={() => success('File verified clean', 'SHA-256 re-check passed with 0 drift')}>
              Test Success Toast
            </Button>
            <Button variant="secondary" onClick={() => error('Hash Mismatch Detected', 'Expected d41d8c... but calculated e99a18...')}>
              Test Error Toast
            </Button>
            <Button variant="secondary" onClick={() => warn('Scanner Not Configured', 'Add VIRUSTOTAL_API_KEY in platform secrets')}>
              Test Warning Toast
            </Button>
          </div>
        </Card>
      </section>

      {/* Modals */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => success('Download started', 'Generating short-lived 60-second signed URL')}
        title="Download Flagged File?"
        description="This file was flagged with High Risk by static heuristics. It contains potential macro execution vectors."
        warningNote="Do not run macros or executable scripts contained inside unless you completely trust the creator."
        confirmLabel="I understand, download anyway"
      />

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => error('Account deleted', 'All vault objects and cryptographic keys purged')}
        title="Permanently Delete Account?"
        description="This will permanently delete your account, purge all encrypted storage objects in your vault prefix, and erase all audit records. This action cannot be reversed."
        requiresTypedWord="DELETE"
        isDestructive
        confirmLabel="Purge Everything"
      />
    </div>
  );
};
