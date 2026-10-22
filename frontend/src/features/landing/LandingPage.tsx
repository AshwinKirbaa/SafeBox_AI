import React, { useState } from 'react';
import { VaultLogo } from '@/components/ui/VaultLogo';
import { Vault3DHeroCanvas } from '@/components/3d/Vault3DHeroCanvas';
import { Button } from '@/components/ui/Button';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { LegalModal } from '@/components/legal/LegalModals';
import { 
  Shield, 
  Lock, 
  Cpu, 
  FileCheck2, 
  History, 
  Sliders, 
  ArrowRight, 
  ChevronDown, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink,
  HardDrive,
  Eye,
  KeyRound,
  FileText,
  Search,
  Sparkles,
  RefreshCw,
  Terminal
} from 'lucide-react';

interface LandingPageProps {
  onLaunchApp: () => void;
  onOpenDesignSystem: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchApp, onOpenDesignSystem }) => {
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'overview' | 'files' | 'drawer'>('overview');
  const [activeStep, setActiveStep] = useState<number>(0);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const steps = [
    {
      num: '01',
      title: 'Upload & Pre-Validate',
      summary: 'W3C Web Crypto computes SHA-256 client-side. Checks 25 MB quota, file extensions, and blocks malicious script extensions.',
      badge: 'Client Validation',
      icon: HardDrive,
      codeSnippet: `// Web Crypto API in browser\nconst buffer = await file.arrayBuffer();\nconst hashBuffer = await crypto.subtle.digest('SHA-256', buffer);\nconst sha256 = Array.from(new Uint8Array(hashBuffer))\n  .map(b => b.toString(16).padStart(2, '0')).join('');`,
    },
    {
      num: '02',
      title: 'Verify Magic Bytes',
      summary: 'Edge engine reads binary headers to ensure file extension matches real binary format. Re-verifies server hash against client claim.',
      badge: 'Anti-Spoofing',
      icon: FileCheck2,
      codeSnippet: `// Server-side magic byte inspection\nconst header = await readFirstBytes(storagePath, 8);\nif (!matchesMagicBytes(header, claimedMime)) {\n  await setStatus(fileId, 'rejected');\n  await logSecurityEvent('TYPE_SPOOF_ATTEMPT', { fileId });\n}`,
    },
    {
      num: '03',
      title: 'Scan & Explain',
      summary: 'VirusTotal SHA-256 hash lookup (file never leaves storage). Advisory AI synthesizes findings into structured plain-English recommendations.',
      badge: 'Multi-Engine + AI',
      icon: Cpu,
      codeSnippet: `// VirusTotal hash lookup adapter\nconst report = await vtAdapter.scanByHash(file.sha256);\n// AI Explainer receives sanitized metadata only\nconst advice = await aiExplainer.synthesize({\n  meta: { name: file.name, size: file.size },\n  vtDetections: report.detections\n});`,
    },
    {
      num: '04',
      title: 'Continuous Monitoring',
      summary: 'Automated weekly cryptographic integrity checks detect any data corruption or tampering. Downloads protected via 60-second signed URLs.',
      badge: 'Cryptographic Drift',
      icon: History,
      codeSnippet: `// Verify integrity edge function\nconst currentHash = await hashStream(storageObject);\nif (currentHash !== storedSha256) {\n  await setIntegrityStatus(fileId, 'mismatch');\n  await triggerAlert('INTEGRITY_TAMPER_DETECTED');\n}`,
    },
  ];

  const faqs = [
    {
      q: 'Is my data end-to-end encrypted (E2EE)?',
      a: 'No, and we state this honestly. SafeBox AI uses TLS 1.3 in transit and provider-managed AES-256 encryption at rest. To compute cryptographic SHA-256 hashes, verify binary magic bytes, and scan files, our server edge functions must inspect file bytes. SafeBox AI is an integrity vault and security analyst, not a zero-knowledge or client-side encrypted vault.',
    },
    {
      q: 'Can the AI assistant tell me a file is 100% "safe"?',
      a: 'No. SafeBox AI strictly enforces that an AI model never decides malware verdicts. The strongest positive statement the platform makes is: "No threats detected by the engines that were run." AI outputs are clearly labeled "Advisory" and only explain findings from deterministic static checks and certified malware scanners.',
    },
    {
      q: 'Does VirusTotal or third parties see my actual file contents?',
      a: 'By default, no. SafeBox AI performs hash-only lookups against VirusTotal database using your file\'s SHA-256. The file contents never leave your private storage bucket. Uploading actual file bytes to external scanners is strictly opt-in in your Privacy Settings and requires explicit per-file confirmation.',
    },
    {
      q: 'What file types are allowed and which are blocked?',
      a: 'Allowed in v1: PDF, PNG, JPG, JPEG, WEBP, GIF, TXT, MD, CSV, DOCX, XLSX, PPTX, and ZIP archives (ZIPs are hashed and scanned, never extracted). Outright blocked: executables and scripts (.exe, .dll, .msi, .bat, .cmd, .sh, .ps1, .js), and script-bearing web formats (.html, .svg). Double extensions like "invoice.pdf.exe" are rejected.',
    },
    {
      q: 'How does cryptographic integrity verification work?',
      a: 'When you upload a file, your browser computes its SHA-256 hash using the W3C Web Crypto API. On demand (via the "Verify now" button) or on a scheduled basis, our edge function re-streams the object from the vault and recomputes the SHA-256 hash. If even a single byte differs, it instantly flags the file with an integrity mismatch event.',
    },
    {
      q: 'What happens if a file is flagged or blocked?',
      a: 'Files with medium or high findings are labeled "Flagged" and require an explicit risk acknowledgment confirmation dialog before download. Files confirmed as malicious by multiple engines or critical static violations are labeled "Blocked" — downloads and previews are permanently disabled to protect your device.',
    },
    {
      q: 'What are the account limits during the beta period?',
      a: 'Every beta account receives a fixed 1 GB storage quota and a 25 MB per-file size limit. Rate limits include 30 uploads/hour, 20 analyses/hour, and 120 downloads/hour. All core features including SHA-256 integrity checks, VirusTotal adapter, and AI advisory analysis are free during beta.',
    },
    {
      q: 'Can I permanently delete my files and account?',
      a: 'Yes. File deletions immediately purge the storage object and database row. Account deletion (in Settings > Data) requires typed "DELETE" confirmation and cascades the purge across all your vault objects, analysis logs, and authentication records.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#05070D] text-[#E6EBF5] font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. Sticky Glass Navigation */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-[rgba(148,163,184,0.14)] px-4 lg:px-8 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <VaultLogo size={36} animated />
            <div>
              <span className="text-lg font-bold font-heading text-white tracking-tight flex items-center gap-1.5">
                SafeBox <span className="text-accent-cyan">AI</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-cyan-400 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-800/40">
                BETA v1.0
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9AA6BD]">
            <a href="#features" className="hover:text-accent-cyan transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-accent-cyan transition-colors">How It Works</a>
            <a href="#security" className="hover:text-accent-cyan transition-colors">Security & Trust</a>
            <a href="#faq" className="hover:text-accent-cyan transition-colors">FAQ</a>
            <button
              onClick={onOpenDesignSystem}
              className="text-xs font-mono text-slate-400 hover:text-white px-2 py-1 rounded bg-[#121826] border border-slate-700/60"
            >
              /design
            </button>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onLaunchApp}>
              Sign In
            </Button>
            <Button variant="primary" size="sm" onClick={onLaunchApp} className="shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              Get Started <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden">
        {/* Subtle background ambient gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-cyan-600/10 blur-[130px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A1022] border border-cyan-500/30 text-xs font-mono text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Cryptographic File Vault + Built-in AI Security Analyst</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-heading text-white tracking-tight leading-[1.12]">
              Your files, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-cyan-200 to-accent-blue">
                guarded and explained.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#9AA6BD] max-w-xl leading-relaxed">
              Store contracts, invoices, and sensitive documents in private storage. Every upload is SHA-256 hashed, verified against magic-byte spoofing, scanned by VirusTotal, and explained in plain English by an advisory AI assistant.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button variant="primary" size="lg" onClick={onLaunchApp} className="shadow-[0_0_20px_rgba(34,211,238,0.35)]">
                Get started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <a href="#how-it-works">
                <Button variant="outline" size="lg">
                  See how it works
                </Button>
              </a>
            </div>

            {/* Verifiable Telemetry Ticker */}
            <div className="pt-6 border-t border-[rgba(148,163,184,0.12)] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-[#9AA6BD] block">Free Beta Quota</span>
                <strong className="text-white text-sm">1 GB / 25 MB file</strong>
              </div>
              <div>
                <span className="text-[#9AA6BD] block">Client Integrity</span>
                <strong className="text-emerald-400 text-sm">SHA-256 WebCrypto</strong>
              </div>
              <div>
                <span className="text-[#9AA6BD] block">Malware Engine</span>
                <strong className="text-cyan-300 text-sm">VirusTotal Adapter</strong>
              </div>
              <div>
                <span className="text-[#9AA6BD] block">AI Analysis</span>
                <strong className="text-blue-400 text-sm">Advisory Only</strong>
              </div>
            </div>
          </div>

          {/* Right Hero 3D Faceted Glass Vault */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            <Vault3DHeroCanvas />
          </div>
        </div>
      </section>

      {/* 3. Product Preview in Tilted Glass Frame */}
      <section className="py-16 bg-[#0A1022]/40 border-y border-[rgba(148,163,184,0.1)]">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#121826] border border-cyan-500/30 text-xs font-mono text-cyan-300">
              <Eye className="w-3.5 h-3.5 text-accent-cyan" />
              <span>Interactive Console</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
              Enterprise Assurance, Zero Setup Friction
            </h2>
            <p className="text-sm text-[#9AA6BD] max-w-lg mx-auto">
              Inspect the live vault dashboard preview below to explore metrics, files, and advisory security breakdowns.
            </p>
          </div>

          {/* Interactive Preview Container with Tilted Frame */}
          <div className="relative rounded-card border border-[rgba(148,163,184,0.2)] bg-[#0A1022] p-4 sm:p-6 shadow-2xl overflow-hidden top-light-border">
            {/* Top Bar with Illustrative Preview Badge */}
            <div className="flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-[rgba(148,163,184,0.12)] gap-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs font-mono text-[#9AA6BD] ml-2">safebox.app/vault/dashboard</span>
              </div>

              {/* Mandatory PDF SPEC label: "Illustrative preview" */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-[11px] font-mono text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <strong>Illustrative preview</strong>
              </div>

              {/* View Switchers */}
              <div className="flex items-center gap-1 bg-[#121826] p-1 rounded-input border border-slate-700/50 text-xs font-mono">
                <button
                  onClick={() => setActivePreviewTab('overview')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activePreviewTab === 'overview' ? 'bg-[#1A2236] text-accent-cyan font-bold' : 'text-[#9AA6BD] hover:text-white'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActivePreviewTab('files')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activePreviewTab === 'files' ? 'bg-[#1A2236] text-accent-cyan font-bold' : 'text-[#9AA6BD] hover:text-white'
                  }`}
                >
                  Files View
                </button>
                <button
                  onClick={() => setActivePreviewTab('drawer')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activePreviewTab === 'drawer' ? 'bg-[#1A2236] text-accent-cyan font-bold' : 'text-[#9AA6BD] hover:text-white'
                  }`}
                >
                  Analysis Drawer
                </button>
              </div>
            </div>

            {/* Tab 1: Overview Mock */}
            {activePreviewTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)]">
                    <span className="text-xs text-[#9AA6BD] block font-mono">STORAGE USED</span>
                    <strong className="text-xl font-bold font-heading text-white">142.8 MB</strong>
                    <div className="w-full bg-[#1A2236] h-1.5 rounded-full mt-2 overflow-hidden">
                      <div className="bg-accent-cyan h-full w-[14%]" />
                    </div>
                    <span className="text-[11px] text-[#9AA6BD] mt-1 block font-mono">14% of 1 GB quota</span>
                  </div>

                  <div className="p-4 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)]">
                    <span className="text-xs text-[#9AA6BD] block font-mono">PROTECTED FILES</span>
                    <strong className="text-xl font-bold font-heading text-emerald-400">28 Files</strong>
                    <span className="text-[11px] text-emerald-300 mt-2 block font-mono">100% SHA-256 Hashed</span>
                  </div>

                  <div className="p-4 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)]">
                    <span className="text-xs text-[#9AA6BD] block font-mono">OPEN FINDINGS</span>
                    <strong className="text-xl font-bold font-heading text-amber-400">1 Flagged</strong>
                    <span className="text-[11px] text-amber-300 mt-2 block font-mono">0 Critical Threats</span>
                  </div>

                  <div className="p-4 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)]">
                    <span className="text-xs text-[#9AA6BD] block font-mono">ACCOUNT SECURITY SCORE</span>
                    <strong className="text-xl font-bold font-heading text-cyan-300">92 / 100</strong>
                    <span className="text-[11px] text-cyan-400 mt-2 block font-mono">Tier: Excellent</span>
                  </div>
                </div>

                {/* Sample Activity Feed */}
                <div className="p-4 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)] space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-[#9AA6BD] border-b border-slate-800 pb-2">
                    <span>RECENT CRYPTOGRAPHIC AUDIT LOGS</span>
                    <span className="text-accent-cyan">Auto-Sync 30s</span>
                  </div>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-300">Master-Services-Agreement.pdf</span>
                      <span className="text-[#9AA6BD]">e3b0c44...</span>
                      <SeverityBadge severity="none" size="sm" />
                    </div>
                    <div className="flex items-center justify-between py-1 border-b border-slate-800/40">
                      <span className="text-slate-300">Financial-Q3-Summary.xlsx</span>
                      <span className="text-[#9AA6BD]">7f83b16...</span>
                      <SeverityBadge severity="medium" label="Macros Found" size="sm" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Files View Mock */}
            {activePreviewTab === 'files' && (
              <div className="space-y-4">
                <div className="p-3 bg-[#121826] rounded-card border border-cyan-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-[#9AA6BD] font-mono">
                    <Search className="w-4 h-4 text-accent-cyan" />
                    <span>Filter: All folders (28 items)</span>
                  </div>
                  <Badge variant="cyan" size="sm">25 MB Limit Enforced</Badge>
                </div>
                <div className="border border-[rgba(148,163,184,0.14)] rounded-card overflow-hidden">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-[#121826] text-[#9AA6BD] border-b border-slate-800">
                      <tr>
                        <th className="p-3">FILE NAME</th>
                        <th className="p-3">SHA-256 HASH</th>
                        <th className="p-3">SIZE</th>
                        <th className="p-3">STATUS</th>
                        <th className="p-3 text-right">INTEGRITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-[#0A1022]">
                      <tr>
                        <td className="p-3 font-medium text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-cyan-400" /> Executive-Employment-Contract.pdf
                        </td>
                        <td className="p-3 text-slate-400">9f86d081884c7d65...</td>
                        <td className="p-3 text-slate-300">2.4 MB</td>
                        <td className="p-3"><SeverityBadge severity="none" size="sm" /></td>
                        <td className="p-3 text-right text-emerald-400 font-bold">VERIFIED</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-medium text-white flex items-center gap-2">
                          <FileText className="w-4 h-4 text-amber-400" /> Vendor-Payment-Script.zip
                        </td>
                        <td className="p-3 text-slate-400">5e884898da280471...</td>
                        <td className="p-3 text-slate-300">14.1 MB</td>
                        <td className="p-3"><SeverityBadge severity="medium" label="Flagged Archive" size="sm" /></td>
                        <td className="p-3 text-right text-amber-400 font-bold">MANUAL REVIEW</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Drawer Mock */}
            {activePreviewTab === 'drawer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-[#121826] rounded-card border border-[rgba(148,163,184,0.1)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold font-heading text-white">VirusTotal Scanner Adapter</h4>
                    <span className="text-[10px] font-mono text-cyan-400">0/72 Engines Detected</span>
                  </div>
                  <p className="text-xs text-[#9AA6BD] leading-relaxed">
                    Hash lookup queried across 72 antivirus telemetry feeds. No threats detected by the engines that were run.
                  </p>
                  <div className="p-2.5 bg-[#0A1022] rounded border border-slate-800 text-[11px] font-mono text-slate-300">
                    <div>Engine: VirusTotal v3 API</div>
                    <div>Mode: Hash Lookup (Zero Byte Upload)</div>
                    <div>Scan Timestamp: 2026-10-21 12:00:00 UTC</div>
                  </div>
                </div>

                <div className="p-4 bg-[#121826] rounded-card border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold font-heading text-accent-cyan flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-accent-cyan" /> AI Explainer (Advisory)
                    </h4>
                    <Badge variant="cyan" size="sm">Advisory Only</Badge>
                  </div>
                  <div className="text-xs text-cyan-200 bg-cyan-950/40 p-2.5 rounded border border-cyan-500/30 font-sans">
                    <strong>Headline:</strong> Verified PDF contract with strict format compliance.
                  </div>
                  <p className="text-xs text-[#9AA6BD] leading-relaxed font-sans">
                    Magic bytes match %PDF-1.7 standard. No embedded JavaScript streams, font payload exploits, or hidden launch actions detected.
                  </p>
                  <div className="text-[10px] font-mono text-amber-400/90 italic">
                    Advisory: AI explanations can be wrong and are not a malware verdict.
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-[rgba(148,163,184,0.12)] flex items-center justify-between text-xs text-[#9AA6BD]">
              <span>Sample data rendered in accordance with SafeBox AI honesty guidelines.</span>
              <Button variant="primary" size="sm" onClick={onLaunchApp}>
                Test Real Vault Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Five Feature Sections Grid */}
      <section id="features" className="py-20 max-w-7xl mx-auto px-4 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="cyan" size="sm">Core Capabilities</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
            Designed for Absolute Data Assurance
          </h2>
          <p className="text-base text-[#9AA6BD]">
            Five verifiable security pillars built without fabricated metrics or deceptive marketing promises.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-4 top-light-border hover:border-cyan-500/40 transition-colors">
            <div className="w-12 h-12 rounded-input bg-[#121826] border border-cyan-500/30 flex items-center justify-center text-accent-cyan shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <HardDrive className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-white">1. Private Storage</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Every file is stored under an isolated private path <code>{'{user_id}/{file_id}'}</code>. Your original filename is never exposed in bucket paths. Provider-managed AES-256 encryption at rest with strict 25 MB file quotas.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-4 top-light-border hover:border-cyan-500/40 transition-colors">
            <div className="w-12 h-12 rounded-input bg-[#121826] border border-blue-500/30 flex items-center justify-center text-accent-blue shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-white">2. AI-Assisted Analysis</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Translates complex engine flags and static signatures into human-readable English. Clearly labeled as "Advisory" — language models never decide malware verdicts, but help you understand technical risks.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-4 top-light-border hover:border-cyan-500/40 transition-colors">
            <div className="w-12 h-12 rounded-input bg-[#121826] border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-white">3. Cryptographic Integrity</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Pre-computed SHA-256 via W3C Web Crypto in your browser, validated server-side. On-demand "Verify now" and scheduled checks detect any bit rot, unauthorized alteration, or storage corruption.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-4 top-light-border hover:border-cyan-500/40 transition-colors">
            <div className="w-12 h-12 rounded-input bg-[#121826] border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.2)]">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-white">4. Security Activity Audit</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Append-only audit trail logs uploads, hash checks, downloads, renames, and deletions. No IP addresses are stored. High-risk security events surface in real-time notifications with acknowledgment workflows.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] space-y-4 top-light-border hover:border-cyan-500/40 transition-colors md:col-span-2 lg:col-span-1">
            <div className="w-12 h-12 rounded-input bg-[#121826] border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
              <Sliders className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-white">5. Transparent Privacy Controls</h3>
            <p className="text-sm text-[#9AA6BD] leading-relaxed">
              Hash lookups are default; your file bytes never leave storage. Granular toggles for third-party uploads and AI text excerpts with full disclosures of exact data boundaries and instant account deletion.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Four-Step How It Works (Scroll-Linked & Interactive Stepper) */}
      <section id="how-it-works" className="py-20 bg-[#0A1022]/60 border-t border-[rgba(148,163,184,0.1)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <Badge variant="cyan" size="sm">Verification Pipeline</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
              How SafeBox AI Guards Every File
            </h2>
            <p className="text-base text-[#9AA6BD]">
              Four verifiable stages from local browser hashing to continuous drift monitoring.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Steps Navigation */}
            <div className="lg:col-span-5 space-y-3">
              {steps.map((st, idx) => {
                const IconComponent = st.icon;
                const isActive = activeStep === idx;
                return (
                  <div
                    key={st.num}
                    onClick={() => setActiveStep(idx)}
                    className={`p-4 rounded-card border cursor-pointer transition-all ${
                      isActive
                        ? 'bg-[#121826] border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                        : 'bg-[#0A1022] border-[rgba(148,163,184,0.1)] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-input flex items-center justify-center font-mono font-bold text-sm ${
                          isActive ? 'bg-cyan-500 text-[#05070D]' : 'bg-[#1A2236] text-[#9AA6BD]'
                        }`}
                      >
                        {st.num}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-base font-bold font-heading ${isActive ? 'text-white' : 'text-[#9AA6BD]'}`}>
                            {st.title}
                          </h4>
                          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                            {st.badge}
                          </span>
                        </div>
                        <p className="text-xs text-[#9AA6BD] mt-1 leading-relaxed">{st.summary}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Interactive Code & Pipeline Visualizer */}
            <div className="lg:col-span-7">
              <div className="rounded-card bg-[#05070D] border border-cyan-500/30 p-6 shadow-2xl space-y-4 top-light-border">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-accent-cyan" />
                    <span className="text-xs font-mono text-white font-semibold">
                      Pipeline Inspector: Step {steps[activeStep].num} — {steps[activeStep].title}
                    </span>
                  </div>
                  <Badge variant="cyan" size="sm">Deterministic Code</Badge>
                </div>

                <p className="text-xs text-[#9AA6BD] leading-relaxed">
                  {steps[activeStep].summary}
                </p>

                {/* Code Window */}
                <div className="p-4 rounded-input bg-[#0A1022] border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto leading-relaxed">
                  <pre>{steps[activeStep].codeSnippet}</pre>
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[#9AA6BD] pt-2">
                  <span>Protected against extension spoofing & tampering</span>
                  <button
                    onClick={() => setActiveStep((s) => (s + 1) % steps.length)}
                    className="text-accent-cyan hover:underline flex items-center gap-1"
                  >
                    Next Stage <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Trust & Security Section + "What SafeBox AI Does NOT Do" */}
      <section id="security" className="py-20 max-w-7xl mx-auto px-4 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge variant="cyan" size="sm">Honest Disclosures</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
            Trust Built on Verifiable Truth
          </h2>
          <p className="text-base text-[#9AA6BD]">
            We refuse to display fake SOC-2 badges or make impossible claims of "100% unbreakable military security".
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Verifiable Architecture */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-xl font-bold font-heading text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              What SafeBox AI Verifiably Does
            </h3>
            <div className="space-y-3 text-sm text-[#9AA6BD]">
              <div className="p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
                <strong className="text-white block mb-1">Row Level Security (RLS) on Every Table</strong>
                Postgres RLS guarantees that only your verified JWT session can query your files, tags, and logs.
              </div>
              <div className="p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
                <strong className="text-white block mb-1">60-Second Ephemeral Signed URLs</strong>
                Files are downloaded only through short-lived signed URLs generated on-demand. Permanent public links do not exist.
              </div>
              <div className="p-4 rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)]">
                <strong className="text-white block mb-1">Strict Extension & Magic Byte Allow-List</strong>
                Executables (.exe, .dll), scripts (.sh, .bat, .js), and script-bearing web formats (.html, .svg) are blocked unconditionally.
              </div>
            </div>
          </div>

          {/* Candid "What SafeBox AI Does NOT Do" Box (Mandated by PDF SPEC) */}
          <div className="lg:col-span-6 rounded-card bg-[#121826] border-2 border-amber-500/40 p-6 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-950/70 border border-amber-500/50 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold font-heading text-amber-300">
                  What SafeBox AI Does NOT Do
                </h3>
                <span className="text-xs font-mono text-amber-200/80">Candid Security Boundaries</span>
              </div>
            </div>

            <ul className="space-y-3 text-xs sm:text-sm text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong className="text-white">No End-to-End Encryption (E2EE):</strong> SafeBox AI is not a zero-knowledge vault. The server inspects binary headers to prevent malware and computes SHA-256 hashes.
              </li>
              <li>
                <strong className="text-white">AI is Strictly Advisory:</strong> An LLM never decides malware verdicts. We never claim a file is "safe"; our strongest verdict is <em>"No threats detected by the engines run."</em>
              </li>
              <li>
                <strong className="text-white">No Zero-Day Guarantees:</strong> Scanners catch known signatures and common heuristics. No automated scanner guarantees 100% prevention of unknown zero-day payloads.
              </li>
              <li>
                <strong className="text-white">No ZIP Archive Extraction:</strong> ZIP files are stored, hashed, and flagged for manual review; server engines never extract nested files to avoid archive zip bombs.
              </li>
            </ul>

            <div className="p-3 bg-[#0A1022] rounded border border-amber-500/30 text-xs font-mono text-amber-200">
              Honesty First: Reviewed against SPEC.md and verified against actual implementation.
            </div>
          </div>
        </div>
      </section>

      {/* 7. Beta Note Instead of Pricing (Mandated by PDF SPEC) */}
      <section className="py-16 bg-[#0A1022]/40 border-y border-[rgba(148,163,184,0.1)]">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
          <Badge variant="cyan" size="sm">Beta Program</Badge>
          <h2 className="text-3xl font-bold font-heading text-white">
            Free During Public Beta
          </h2>
          <p className="text-base text-[#9AA6BD] leading-relaxed">
            SafeBox AI does not feature paid tiers or billing in v1. Every registered user receives our full security suite without subscription barriers.
          </p>

          <div className="p-8 rounded-card bg-[#0A1022] border border-cyan-500/40 text-left space-y-6 shadow-2xl top-light-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
              <div>
                <h3 className="text-xl font-bold font-heading text-white">Single-User Beta Account</h3>
                <span className="text-xs text-[#9AA6BD] font-mono">Full Cryptographic & Advisory Capabilities</span>
              </div>
              <div className="text-3xl font-bold font-heading text-accent-cyan">
                $0 <span className="text-sm font-sans font-normal text-[#9AA6BD]">/ beta</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>1 GB Account Storage Quota</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>25 MB Max Per-File Size</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Web Crypto SHA-256 Hashing</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>VirusTotal Hash Lookup Adapter</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Advisory AI Explainer Reports</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Append-Only Activity Audit Trail</span>
              </div>
            </div>

            <Button variant="primary" size="lg" className="w-full" onClick={onLaunchApp}>
              Claim Your 1 GB Free Vault <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* 8. FAQ Accordion (8-10 Honest Questions) */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 lg:px-8 space-y-10">
        <div className="text-center space-y-3">
          <Badge variant="cyan" size="sm">Transparent Answers</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold font-heading text-white tracking-tight">
            Frequently Answered Questions
          </h2>
          <p className="text-base text-[#9AA6BD]">
            Straightforward answers regarding encryption, AI boundaries, quotas, and privacy.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-card bg-[#0A1022] border border-[rgba(148,163,184,0.14)] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 text-white hover:text-accent-cyan transition-colors"
                  aria-expanded={isExpanded}
                >
                  <span className="text-base font-semibold font-heading">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 flex-shrink-0 text-accent-cyan transition-transform duration-300 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="px-5 pb-5 text-sm text-[#9AA6BD] leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. Final CTA Band */}
      <section className="py-20 bg-gradient-to-b from-[#0A1022] to-[#05070D] border-t border-[rgba(148,163,184,0.14)] text-center">
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          <VaultLogo size={64} animated glow className="mx-auto" />
          <h2 className="text-3xl sm:text-5xl font-bold font-heading text-white tracking-tight">
            Ready to secure your most sensitive files?
          </h2>
          <p className="text-base sm:text-lg text-[#9AA6BD] max-w-xl mx-auto">
            Experience cryptographic integrity verification and AI advisory clarity in action.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Button variant="primary" size="lg" onClick={onLaunchApp} className="shadow-[0_0_25px_rgba(34,211,238,0.35)]">
              Launch SafeBox AI Vault <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" size="lg" onClick={onOpenDesignSystem}>
              View Design System (/design)
            </Button>
          </div>
        </div>
      </section>

      {/* 10. Footer with Real Legal Content Modals */}
      <footer className="border-t border-[rgba(148,163,184,0.12)] bg-[#05070D] py-12 px-4 lg:px-8 text-sm text-[#9AA6BD]">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <VaultLogo size={24} />
              <span className="font-bold font-heading text-white">SafeBox AI</span>
            </div>
            <p className="text-xs text-[#9AA6BD] leading-relaxed">
              Cryptographic file vault with advisory AI analysis. Desktop-first with full mobile support.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-white font-heading mb-3 text-xs uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#features" className="hover:text-accent-cyan">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-accent-cyan">Verification Pipeline</a></li>
              <li><a href="#security" className="hover:text-accent-cyan">Security Disclosures</a></li>
              <li><button onClick={onLaunchApp} className="hover:text-accent-cyan">Vault Dashboard</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white font-heading mb-3 text-xs uppercase tracking-wider">Support</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#faq" className="hover:text-accent-cyan">FAQ</a></li>
              <li><a href="mailto:security@safebox.ai" className="hover:text-accent-cyan">security@safebox.ai</a></li>
              <li><button onClick={onOpenDesignSystem} className="hover:text-accent-cyan">Design Tokens</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white font-heading mb-3 text-xs uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => setLegalModalType('privacy')}
                  className="hover:text-accent-cyan underline text-left"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => setLegalModalType('terms')}
                  className="hover:text-accent-cyan underline text-left"
                >
                  Terms of Service
                </button>
              </li>
              <li className="text-[11px] text-slate-500 pt-1 font-mono">
                No E2EE Claimed • Advisory AI
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-[rgba(148,163,184,0.08)] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <div>© {new Date().getFullYear()} SafeBox AI. All rights reserved. Free beta release.</div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>WCAG 2.2 AA</span>
            <span>•</span>
            <span>Web Crypto SHA-256</span>
            <span>•</span>
            <span>DPR Capped 1.75</span>
          </div>
        </div>
      </footer>

      {/* Legal Modals */}
      {legalModalType && (
        <LegalModal
          isOpen={!!legalModalType}
          onClose={() => setLegalModalType(null)}
          type={legalModalType}
        />
      )}
    </div>
  );
};
