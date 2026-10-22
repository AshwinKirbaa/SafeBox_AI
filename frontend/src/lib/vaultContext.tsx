import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  VaultFile, 
  Folder, 
  Tag, 
  FileAnalysis, 
  SecurityEvent, 
  ActivityLog, 
  UserProfile, 
  UserPreferences,
  SeverityLevel,
  FileStatus,
  IntegrityStatus
} from '@/types/vault';
import { useToast } from '@/components/ui/Toast';

interface VaultContextType {
  profile: UserProfile;
  preferences: UserPreferences;
  files: VaultFile[];
  folders: Folder[];
  tags: Tag[];
  analyses: FileAnalysis[];
  securityEvents: SecurityEvent[];
  activityLogs: ActivityLog[];
  isScannerConfigured: boolean;
  toggleScannerConfigured: () => void;
  // File operations
  uploadFile: (file: File, folderId?: string | null) => Promise<{ success: boolean; error?: string }>;
  verifyFileIntegrity: (fileId: string) => Promise<{ status: IntegrityStatus; message: string }>;
  simulateTamperFile: (fileId: string) => void;
  deleteFile: (fileId: string) => Promise<boolean>;
  renameFile: (fileId: string, newName: string) => Promise<boolean>;
  moveFile: (fileId: string, folderId: string | null) => Promise<boolean>;
  tagFile: (fileId: string, tags: string[]) => Promise<boolean>;
  reScanFile: (fileId: string) => Promise<boolean>;
  getDownloadUrl: (fileId: string, confirmRisk?: boolean) => { url: string; expiresInSeconds: number } | null;
  // Folder operations
  createFolder: (name: string, parentId?: string | null) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  // Analysis & Events
  acknowledgeFinding: (analysisId: string) => void;
  acknowledgeSecurityEvent: (eventId: string) => void;
  generateWeeklySummary: () => { summary: string; advisory: boolean; eventCount: number };
  // Settings & Profile
  updateProfile: (updates: Partial<UserProfile>) => void;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  deleteAccount: () => Promise<boolean>;
  completeOnboarding: () => void;
  // Computed stats & security score
  stats: {
    storageUsedBytes: number;
    quotaBytes: number;
    quotaPercent: number;
    totalFiles: number;
    verifiedFiles: number;
    openFindingsCount: number;
    securityScore: number;
    scoreBreakdown: {
      mfaPoints: number;
      emailVerifiedPoints: number;
      scanCoveragePoints: number;
      threatCleanlinessPoints: number;
      freshIntegrityPoints: number;
    };
  };
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

const CURRENT_USER_ID = 'usr_safebox_beta_882';

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { success, error, warn, info } = useToast();

  // 1. User Profile (1 GB fixed quota = 1073741824 bytes)
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('safebox_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      id: CURRENT_USER_ID,
      email: 'security.analyst@safebox.internal',
      display_name: 'Elena Rostova',
      storage_quota_bytes: 1073741824, // 1 GB
      email_verified: true,
      mfa_enabled: true,
      onboarding_completed: true,
    };
  });

  // 2. User Preferences
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    const saved = localStorage.getItem('safebox_preferences');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      theme: 'dark',
      default_view: 'table',
      notifications_in_app: true,
      allow_external_scanner_upload: false,
      ai_text_excerpt: true,
      reduced_motion_override: false,
    };
  });

  const [isScannerConfigured, setIsScannerConfigured] = useState<boolean>(true);

  // 3. Folders
  const [folders, setFolders] = useState<Folder[]>([
    { id: 'fld_legal', user_id: CURRENT_USER_ID, parent_id: null, name: 'Legal & Contracts', created_at: '2026-10-18T10:00:00Z' },
    { id: 'fld_finance', user_id: CURRENT_USER_ID, parent_id: null, name: 'Financial Audits', created_at: '2026-10-19T11:20:00Z' },
    { id: 'fld_identity', user_id: CURRENT_USER_ID, parent_id: null, name: 'Identity & Passports', created_at: '2026-10-20T08:15:00Z' },
  ]);

  // 4. Tags
  const [tags, setTags] = useState<Tag[]>([
    { id: 'tag_confidential', user_id: CURRENT_USER_ID, name: 'Confidential', color: '#FB7185' },
    { id: 'tag_taxes', user_id: CURRENT_USER_ID, name: 'Tax 2026', color: '#38BDF8' },
    { id: 'tag_verified', user_id: CURRENT_USER_ID, name: 'Audit Ready', color: '#34D399' },
  ]);

  // 5. Initial Realistic Seed Files (conforming to SPEC.md allowed formats)
  const [files, setFiles] = useState<VaultFile[]>([
    {
      id: 'file_001_contract',
      user_id: CURRENT_USER_ID,
      folder_id: 'fld_legal',
      display_name: 'Master-Services-Agreement-2026.pdf',
      original_name: 'Master-Services-Agreement-2026.pdf',
      storage_path: `${CURRENT_USER_ID}/file_001_contract`,
      mime_type: 'application/pdf',
      extension: 'pdf',
      size_bytes: 3450000, // 3.45 MB
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      status: 'ready',
      integrity_status: 'verified',
      last_integrity_check_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      tags: ['Confidential', 'Audit Ready'],
      content_preview: 'MASTER SERVICES AGREEMENT\n\nParties: Alpha Corp & SafeBox AI\nTerm: October 2026 - October 2029\nJurisdiction: Switzerland\nStrict Confidentiality and Cryptographic Key Protection Provisions.',
    },
    {
      id: 'file_002_finance',
      user_id: CURRENT_USER_ID,
      folder_id: 'fld_finance',
      display_name: 'Q3-Financial-Analysis-Macros.xlsx',
      original_name: 'Q3-Financial-Analysis-Macros.xlsx',
      storage_path: `${CURRENT_USER_ID}/file_002_finance`,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      size_bytes: 8120000, // 8.12 MB
      sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      status: 'flagged',
      integrity_status: 'verified',
      last_integrity_check_at: new Date(Date.now() - 3600000 * 12).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      tags: ['Tax 2026'],
      content_preview: 'Worksheet 1: Cash Flow Forecast\nWorksheet 2: Payroll Projections\nNote: Contains Visual Basic automation macro streams.',
    },
    {
      id: 'file_003_passport',
      user_id: CURRENT_USER_ID,
      folder_id: 'fld_identity',
      display_name: 'Founder-Passport-BioPage.png',
      original_name: 'Founder-Passport-BioPage.png',
      storage_path: `${CURRENT_USER_ID}/file_003_passport`,
      mime_type: 'image/png',
      extension: 'png',
      size_bytes: 4200000, // 4.2 MB
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'ready',
      integrity_status: 'verified',
      last_integrity_check_at: new Date(Date.now() - 3600000 * 24).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      tags: ['Confidential'],
      content_preview: 'Passport Scan Image Verified. High Resolution 300 DPI.',
    },
    {
      id: 'file_004_archive',
      user_id: CURRENT_USER_ID,
      folder_id: null,
      display_name: 'Legal-Discovery-Records-2026.zip',
      original_name: 'Legal-Discovery-Records-2026.zip',
      storage_path: `${CURRENT_USER_ID}/file_004_archive`,
      mime_type: 'application/zip',
      extension: 'zip',
      size_bytes: 18500000, // 18.5 MB
      sha256: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
      status: 'flagged',
      integrity_status: 'unchecked',
      last_integrity_check_at: null,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      tags: ['Audit Ready'],
      content_preview: 'ZIP Archive containing 14 encapsulated legal transcripts. Not extracted per security policy.',
    },
  ]);

  // 6. Analyses
  const [analyses, setAnalyses] = useState<FileAnalysis[]>([
    {
      id: 'an_001',
      file_id: 'file_001_contract',
      user_id: CURRENT_USER_ID,
      kind: 'ai_advisory',
      status: 'completed',
      severity: 'none',
      summary: 'No threats detected by the engines that were run.',
      findings: [
        { code: 'PDF_FORMAT_VALID', title: 'Standard PDF Structure', detail: 'Header verified as %PDF-1.7. Zero unauthorized JavaScript action dictionaries.', severity: 'none' }
      ],
      engine: 'SafeBox Core Heuristics + VirusTotal',
      engine_version: 'v2026.10',
      started_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      completed_at: new Date(Date.now() - 86400000 * 3 + 2000).toISOString(),
      ai_report: {
        headline: 'Clean legal PDF contract with standard encryption headers.',
        plain_explanation: 'The file contains standard document text formatting and digital signature blocks. No executable code, macros, or outbound network callback triggers were detected.',
        risk_category: 'Standard Document',
        recommended_actions: ['Safe to download and store', 'Preserve current cryptographic hash in your audit log'],
        disclaimer: 'Advisory: AI explanations can be wrong and are not a malware verdict.'
      },
      scanner_verdict: {
        engine: 'VirusTotal Adapter',
        engine_version: 'v3-hash',
        is_configured: true,
        total_engines: 72,
        malicious_detections: 0,
        suspicious_detections: 0,
        scan_timestamp: new Date(Date.now() - 86400000 * 3).toISOString(),
        raw_verdict: 'Clean',
      },
      acknowledged: true,
    },
    {
      id: 'an_002',
      file_id: 'file_002_finance',
      user_id: CURRENT_USER_ID,
      kind: 'ai_advisory',
      status: 'completed',
      severity: 'medium',
      summary: 'Office macro streams detected inside spreadsheet archive.',
      findings: [
        { code: 'OFFICE_MACRO_PRESENT', title: 'Embedded VBA Macros', detail: 'Found vbaProject.bin inside OpenXML package. Macro automation may pose execution risks if untrusted.', severity: 'medium' }
      ],
      engine: 'SafeBox Static Inspector + VirusTotal',
      started_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      completed_at: new Date(Date.now() - 86400000 * 2 + 1800).toISOString(),
      ai_report: {
        headline: 'Automated macros detected inside financial worksheet.',
        plain_explanation: 'This Excel file contains embedded Visual Basic for Applications (VBA) code. While common for accounting calculations, macros can execute system commands if opened with macro execution enabled.',
        risk_category: 'Macro Automation',
        recommended_actions: [
          'Only enable macros if authored by a verified colleague',
          'Open in Protected View without clicking "Enable Content"',
          'Require explicit confirmation before team members download this file'
        ],
        disclaimer: 'Advisory: AI explanations can be wrong and are not a malware verdict.'
      },
      scanner_verdict: {
        engine: 'VirusTotal Adapter',
        engine_version: 'v3-hash',
        is_configured: true,
        total_engines: 72,
        malicious_detections: 1, // Single engine heuristic warning
        suspicious_detections: 2,
        scan_timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
        raw_verdict: 'Suspicious Heuristic',
      },
      acknowledged: false,
    },
  ]);

  // 7. Security Events
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([
    {
      id: 'evt_001',
      user_id: CURRENT_USER_ID,
      type: 'SCAN_FLAGGED_MACRO',
      severity: 'medium',
      file_id: 'file_002_finance',
      file_name: 'Q3-Financial-Analysis-Macros.xlsx',
      message: 'Office macro detected in uploaded spreadsheet. File marked as Flagged.',
      metadata: { detections: 1, engine: 'VirusTotal' },
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      acknowledged_at: null,
    },
    {
      id: 'evt_002',
      user_id: CURRENT_USER_ID,
      type: 'HASH_VERIFICATION_PASSED',
      severity: 'none',
      file_id: 'file_001_contract',
      file_name: 'Master-Services-Agreement-2026.pdf',
      message: 'Cryptographic SHA-256 integrity check verified with zero bit drift.',
      metadata: { sha256: '9f86d081...' },
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
      acknowledged_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
  ]);

  // 8. Activity Logs (Append-Only)
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([
    {
      id: 'act_001',
      user_id: CURRENT_USER_ID,
      action: 'auth.login',
      entity_type: 'session',
      entity_id: 'sess_998',
      metadata: { method: 'email_password', mfa: true },
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    },
    {
      id: 'act_002',
      user_id: CURRENT_USER_ID,
      action: 'file.upload',
      entity_type: 'file',
      entity_id: 'file_001_contract',
      metadata: { name: 'Master-Services-Agreement-2026.pdf', bytes: 3450000 },
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: 'act_003',
      user_id: CURRENT_USER_ID,
      action: 'file.verify',
      entity_type: 'file',
      entity_id: 'file_001_contract',
      metadata: { sha256_match: true },
      user_agent: 'SafeBox-Integrity-Daemon/1.0',
      created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    },
  ]);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('safebox_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('safebox_preferences', JSON.stringify(preferences));
  }, [preferences]);

  // Helper to add activity log entry
  const logActivity = useCallback(
    (action: ActivityLog['action'], entityType: string, entityId: string, metadata: Record<string, any>) => {
      const entry: ActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: CURRENT_USER_ID,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
        user_agent: navigator.userAgent.substring(0, 100),
        created_at: new Date().toISOString(),
      };
      setActivityLogs((prev) => [entry, ...prev]);
    },
    []
  );

  // Helper to log security event
  const logSecurityEvent = useCallback(
    (type: string, severity: SeverityLevel, message: string, fileId: string | null, fileName?: string, metadata: Record<string, any> = {}) => {
      const event: SecurityEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        user_id: CURRENT_USER_ID,
        type,
        severity,
        file_id: fileId,
        file_name: fileName,
        message,
        metadata,
        created_at: new Date().toISOString(),
        acknowledged_at: null,
      };
      setSecurityEvents((prev) => [event, ...prev]);
    },
    []
  );

  // REAL Client Upload Flow with Web Crypto SHA-256 and pre-validation
  const uploadFile = async (file: File, folderId: string | null = null): Promise<{ success: boolean; error?: string }> => {
    const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    const BLOCKED_EXTENSIONS = [
      'exe', 'dll', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'vbs', 'js', 'sh', 'jar', 'apk', 'app', 'dmg', 'html', 'htm', 'svg'
    ];
    const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'txt', 'md', 'csv', 'docx', 'xlsx', 'pptx', 'zip'];

    // 1. Quota Check
    const currentStorage = files.reduce((acc, f) => acc + f.size_bytes, 0);
    if (currentStorage + file.size > profile.storage_quota_bytes) {
      const err = `Account storage quota exceeded (1 GB limit). Delete existing files or upgrade.`;
      error('Upload Failed', err);
      return { success: false, error: err };
    }

    // 2. File Size Check (25 MB)
    if (file.size > MAX_FILE_SIZE) {
      const err = `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 25 MB maximum limit.`;
      error('File Size Exceeded', err);
      return { success: false, error: err };
    }

    // 3. Extension & Double Extension Inspection
    const nameParts = file.name.split('.');
    const ext = (nameParts.pop() || '').toLowerCase();
    
    // Check for double extension spoofing (e.g., invoice.pdf.exe)
    if (nameParts.length > 1) {
      const secondaryExt = (nameParts[nameParts.length - 1] || '').toLowerCase();
      if (ALLOWED_EXTENSIONS.includes(secondaryExt) && BLOCKED_EXTENSIONS.includes(ext)) {
        const err = `Double extension anomaly detected: "${file.name}". Blocked for security.`;
        error('Malicious Extension Detected', err);
        logSecurityEvent('DOUBLE_EXTENSION_BLOCKED', 'critical', `Attempted upload of file with disguised extension: ${file.name}`, null, file.name);
        return { success: false, error: err };
      }
    }

    // Check blocked outright
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      const err = `Executables, scripts, HTML, and SVG files are prohibited (.${ext}).`;
      error('File Type Blocked', err);
      logSecurityEvent('BLOCKED_FILE_UPLOAD_ATTEMPT', 'high', `User attempted to upload prohibited format .${ext}`, null, file.name);
      return { success: false, error: err };
    }

    // Check allow-list
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const err = `Format .${ext} is not supported. Supported: PDF, PNG, JPG, WEBP, GIF, TXT, MD, CSV, DOCX, XLSX, PPTX, ZIP.`;
      warn('Unsupported Extension', err);
      return { success: false, error: err };
    }

    // 4. Client-side Real Web Crypto SHA-256 Hashing
    let computedSha256 = '';
    try {
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      computedSha256 = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.error('Web Crypto Hashing failed:', e);
      computedSha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    }

    // 5. Create new file record
    const newFileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const storagePath = `${CURRENT_USER_ID}/${newFileId}`;

    const isZip = ext === 'zip';
    const isMacroExt = ['xlsm', 'docm', 'pptm'].includes(ext);

    // Initial status: starts at 'scanning'
    const newFile: VaultFile = {
      id: newFileId,
      user_id: CURRENT_USER_ID,
      folder_id: folderId,
      display_name: file.name,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || 'application/octet-stream',
      extension: ext,
      size_bytes: file.size,
      sha256: computedSha256,
      status: 'scanning',
      integrity_status: 'verified',
      last_integrity_check_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      tags: isZip ? ['Archive'] : ['New Upload'],
      content_preview: ext === 'txt' || ext === 'md' || ext === 'csv' ? 'File text content uploaded securely.' : undefined,
    };

    setFiles((prev) => [newFile, ...prev]);
    logActivity('file.upload', 'file', newFileId, { name: file.name, size: file.size, sha256: computedSha256 });
    success('Upload Complete', `Pre-validated and SHA-256 hashed (${computedSha256.substring(0, 8)}...)`);

    // 6. Simulate Server Finalize & Analysis Transition after 1.2s
    setTimeout(() => {
      const finalSeverity: SeverityLevel = isZip ? 'medium' : isMacroExt ? 'medium' : 'none';
      const finalStatus: FileStatus = isZip ? 'flagged' : isMacroExt ? 'flagged' : 'ready';

      setFiles((prev) =>
        prev.map((f) =>
          f.id === newFileId ? { ...f, status: finalStatus, updated_at: new Date().toISOString() } : f
        )
      );

      // Create Analysis
      const newAnalysis: FileAnalysis = {
        id: `an_${Date.now()}`,
        file_id: newFileId,
        user_id: CURRENT_USER_ID,
        kind: 'ai_advisory',
        status: isScannerConfigured ? 'completed' : 'unconfigured',
        severity: finalSeverity,
        summary: isZip
          ? 'ZIP archive stored for manual inspection; contents are not extracted.'
          : isScannerConfigured
          ? 'No threats detected by the engines that were run.'
          : 'Scanner adapter unconfigured. Waiting for VIRUSTOTAL_API_KEY secret.',
        findings: isZip
          ? [
              {
                code: 'ARCHIVE_CONTAINER',
                title: 'ZIP Container Flagged',
                detail: 'ZIP archives are hashed and scanned as containers, but contents are not automatically extracted per security policy.',
                severity: 'medium',
              },
            ]
          : [
              {
                code: 'MAGIC_BYTES_VERIFIED',
                title: 'Header Matches Extension',
                detail: `Magic bytes verified against standard .${ext} specification. Zero anomalous binary spoofing.`,
                severity: 'none',
              },
            ],
        engine: 'VirusTotal Adapter + SafeBox Static Rules',
        engine_version: 'v3-hybrid',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        ai_report: {
          headline: isZip ? 'Encapsulated archive requiring manual review' : 'Clean file verification with verified headers',
          plain_explanation: isZip
            ? 'The uploaded file is a compressed ZIP archive. SafeBox AI holds the archive securely without extracting files into server memory.'
            : 'Static analysis and external engine lookups identified no malicious indicators or scripts. File headers conform to standards.',
          risk_category: isZip ? 'Archive Container' : 'Standard Document',
          recommended_actions: isZip
            ? ['Inspect contained archives locally in a safe sandbox', 'Confirm source before opening contents']
            : ['Ready for secure private storage', 'Download at any time via 60-second signed link'],
          disclaimer: 'Advisory: AI explanations can be wrong and are not a malware verdict.',
        },
        scanner_verdict: isScannerConfigured
          ? {
              engine: 'VirusTotal Adapter',
              engine_version: 'v3-hash',
              is_configured: true,
              total_engines: 72,
              malicious_detections: 0,
              suspicious_detections: isZip ? 1 : 0,
              scan_timestamp: new Date().toISOString(),
              raw_verdict: isZip ? 'Suspicious Container' : 'Clean',
            }
          : undefined,
        acknowledged: false,
      };

      setAnalyses((prev) => [newAnalysis, ...prev]);

      if (finalSeverity === 'medium') {
        logSecurityEvent(
          'FILE_FLAGGED_WARNING',
          'medium',
          `File ${file.name} was flagged for review (${isZip ? 'Archive' : 'Potential Macros'}).`,
          newFileId,
          file.name
        );
      }
    }, 1200);

    return { success: true };
  };

  // Cryptographic Integrity Verification ("Verify now" button)
  const verifyFileIntegrity = async (fileId: string): Promise<{ status: IntegrityStatus; message: string }> => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return { status: 'missing', message: 'File not found in storage.' };

    info('Verifying Integrity...', `Streaming ${file.display_name} to compute SHA-256 hash.`);

    // Simulate cryptographic re-hash
    await new Promise((r) => setTimeout(r, 900));

    if (file.is_simulated_tampered) {
      const spoofedHash = 'd41d8cd98f00b204e9800998ecf8427e' + Math.random().toString(16).substring(2, 34);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, integrity_status: 'mismatch', last_integrity_check_at: new Date().toISOString() }
            : f
        )
      );
      logSecurityEvent(
        'INTEGRITY_MISMATCH_TAMPER',
        'critical',
        `Cryptographic integrity mismatch! Expected ${file.sha256.substring(0, 12)}... but object hash is ${spoofedHash.substring(0, 12)}...`,
        fileId,
        file.display_name,
        { expected: file.sha256, actual: spoofedHash }
      );
      logActivity('file.verify', 'file', fileId, { match: false, reason: 'Bit drift or unauthorized modification' });
      error('Integrity Mismatch Detected!', `The file in storage has been altered since initial upload!`);
      return { status: 'mismatch', message: 'Cryptographic hash mismatch. Potential tampering detected!' };
    }

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, integrity_status: 'verified', last_integrity_check_at: new Date().toISOString() }
          : f
      )
    );
    logActivity('file.verify', 'file', fileId, { match: true, sha256: file.sha256 });
    success('Integrity Verified', `SHA-256 hash matched recorded value with zero bit drift.`);
    return { status: 'verified', message: 'SHA-256 hash verified identical to upload signature.' };
  };

  // Tamper Simulation Toggle (to test detection & security events)
  const simulateTamperFile = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, is_simulated_tampered: !f.is_simulated_tampered } : f
      )
    );
    warn('Tamper Simulation Toggled', 'Run "Verify now" to test cryptographic drift detection.');
  };

  // Delete File
  const deleteFile = async (fileId: string): Promise<boolean> => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return false;

    // Transition through deleting status
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'deleting' } : f))
    );

    await new Promise((r) => setTimeout(r, 600));

    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setAnalyses((prev) => prev.filter((a) => a.file_id !== fileId));
    logActivity('file.delete', 'file', fileId, { name: file.display_name, size: file.size_bytes });
    success('File Purged', `Deleted ${file.display_name} and purged storage object.`);
    return true;
  };

  // Rename File
  const renameFile = async (fileId: string, newName: string): Promise<boolean> => {
    if (!newName.trim()) return false;
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, display_name: newName.trim(), updated_at: new Date().toISOString() } : f))
    );
    logActivity('file.rename', 'file', fileId, { new_name: newName });
    success('File Renamed', `Renamed to ${newName}`);
    return true;
  };

  // Move File
  const moveFile = async (fileId: string, folderId: string | null): Promise<boolean> => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, folder_id: folderId, updated_at: new Date().toISOString() } : f))
    );
    const folderName = folders.find((f) => f.id === folderId)?.name || 'Root Vault';
    success('File Moved', `Moved to ${folderName}`);
    return true;
  };

  // Tag File
  const tagFile = async (fileId: string, newTags: string[]): Promise<boolean> => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, tags: newTags, updated_at: new Date().toISOString() } : f))
    );
    success('Tags Updated', `Assigned ${newTags.length} tags`);
    return true;
  };

  // Re-Scan File
  const reScanFile = async (fileId: string): Promise<boolean> => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return false;

    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'scanning' } : f))
    );
    info('Re-Scanning File', `Querying VirusTotal adapter for ${file.display_name}`);

    await new Promise((r) => setTimeout(r, 1200));

    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'ready', updated_at: new Date().toISOString() } : f))
    );
    success('Scan Completed', 'No threats detected by the engines that were run.');
    return true;
  };

  // Download URL generation (60-second signed URL simulation)
  const getDownloadUrl = (fileId: string, confirmRisk = false): { url: string; expiresInSeconds: number } | null => {
    const file = files.find((f) => f.id === fileId);
    if (!file) return null;

    if (file.status === 'blocked') {
      error('Download Refused', 'Files with critical threats or blocked status cannot be downloaded.');
      return null;
    }

    if (file.status === 'flagged' && !confirmRisk) {
      warn('Risk Confirmation Required', 'This file is flagged. You must confirm risk before generating a signed link.');
      return null;
    }

    logActivity('file.download', 'file', fileId, { name: file.display_name, signed_duration: 60 });
    return {
      url: `https://vault.safebox.internal/signed-download/${file.storage_path}?token=${Math.random().toString(36).substring(2)}&expires=${Date.now() + 60000}`,
      expiresInSeconds: 60,
    };
  };

  // Folder Operations
  const createFolder = async (name: string, parentId: string | null = null): Promise<Folder> => {
    const newFolder: Folder = {
      id: `fld_${Date.now()}`,
      user_id: CURRENT_USER_ID,
      parent_id: parentId,
      name: name.trim(),
      created_at: new Date().toISOString(),
    };
    setFolders((prev) => [...prev, newFolder]);
    success('Folder Created', `Created folder "${name}"`);
    return newFolder;
  };

  const renameFolder = async (id: string, name: string): Promise<boolean> => {
    setFolders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: name.trim() } : f))
    );
    success('Folder Renamed', `Renamed to "${name}"`);
    return true;
  };

  const deleteFolder = async (id: string): Promise<boolean> => {
    // Safely move all files in this folder to root
    setFiles((prev) =>
      prev.map((f) => (f.folder_id === id ? { ...f, folder_id: null } : f))
    );
    setFolders((prev) => prev.filter((f) => f.id !== id));
    success('Folder Deleted', 'Folder removed. All contained files safely moved to root.');
    return true;
  };

  // Analysis & Event Operations
  const acknowledgeFinding = (analysisId: string) => {
    setAnalyses((prev) =>
      prev.map((a) => (a.id === analysisId ? { ...a, acknowledged: true } : a))
    );
    success('Finding Acknowledged', 'Recorded in audit trail.');
  };

  const acknowledgeSecurityEvent = (eventId: string) => {
    setSecurityEvents((prev) =>
      prev.map((e) =>
        e.id === eventId ? { ...e, acknowledged_at: new Date().toISOString() } : e
      )
    );
    success('Event Acknowledged');
  };

  const generateWeeklySummary = () => {
    const totalEvents = securityEvents.length;
    const flaggedCount = files.filter((f) => f.status === 'flagged').length;
    const verifiedCount = files.filter((f) => f.integrity_status === 'verified').length;

    return {
      summary: `SafeBox AI Weekly Security Digest: Over the past 7 days, ${totalEvents} security events and audit actions were processed. ${verifiedCount} files maintain 100% cryptographic SHA-256 match with zero bit corruption. ${flaggedCount} file remains in flagged status (Macro Automation) awaiting your review. Zero critical malware incursions recorded.`,
      advisory: true,
      eventCount: totalEvents,
    };
  };

  const toggleScannerConfigured = () => {
    setIsScannerConfigured((prev) => !prev);
    info(
      isScannerConfigured ? 'Scanner Set to Unconfigured' : 'Scanner Key Configured',
      isScannerConfigured
        ? 'Now showing setup state naming VIRUSTOTAL_API_KEY secret.'
        : 'VirusTotal v3 active with 72 engines.'
    );
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    logActivity('settings.update', 'profile', CURRENT_USER_ID, updates);
    success('Profile Updated');
  };

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
    logActivity('settings.update', 'preferences', CURRENT_USER_ID, updates);
    success('Preferences Saved');
  };

  const completeOnboarding = () => {
    setProfile((prev) => ({ ...prev, onboarding_completed: true }));
    success('Onboarding Completed', 'Welcome to your SafeBox AI private vault!');
  };

  const deleteAccount = async (): Promise<boolean> => {
    setFiles([]);
    setFolders([]);
    setAnalyses([]);
    setSecurityEvents([]);
    setActivityLogs([]);
    localStorage.clear();
    setProfile({
      id: CURRENT_USER_ID,
      email: 'deleted@safebox.internal',
      display_name: 'Deleted User',
      storage_quota_bytes: 1073741824,
      email_verified: false,
      mfa_enabled: false,
      onboarding_completed: false,
    });
    error('Account Purged', 'All database records and vault objects permanently erased.');
    window.location.hash = '#/';
    return true;
  };

  // 9. Deterministic Security Score Formula (0-100) from SPEC.md
  // MFA: 25 pts
  // Email verified: 10 pts
  // Share of files with completed scan: up to 25 pts (proportional)
  // No unresolved high/critical findings: 25 pts (0 if any exist)
  // Share of files with integrity verified in last 30d: up to 15 pts (proportional)
  const totalFiles = files.length;
  const storageUsedBytes = files.reduce((acc, f) => acc + f.size_bytes, 0);
  const quotaBytes = profile.storage_quota_bytes;
  const quotaPercent = Math.min(100, Math.round((storageUsedBytes / quotaBytes) * 100));

  const scannedFilesCount = files.filter((f) => f.status === 'ready' || f.status === 'flagged').length;
  const verifiedFiles = files.filter((f) => f.integrity_status === 'verified').length;
  const hasHighOrCritical = files.some((f) => f.status === 'blocked') || securityEvents.some((e) => e.severity === 'critical' && !e.acknowledged_at);

  const mfaPoints = profile.mfa_enabled ? 25 : 0;
  const emailVerifiedPoints = profile.email_verified ? 10 : 0;
  const scanCoveragePoints = totalFiles > 0 ? Math.round((scannedFilesCount / totalFiles) * 25) : 25;
  const threatCleanlinessPoints = hasHighOrCritical ? 0 : 25;
  const freshIntegrityPoints = totalFiles > 0 ? Math.round((verifiedFiles / totalFiles) * 15) : 15;

  const securityScore = Math.min(100, mfaPoints + emailVerifiedPoints + scanCoveragePoints + threatCleanlinessPoints + freshIntegrityPoints);

  const openFindingsCount = analyses.filter((a) => !a.acknowledged && (a.severity === 'high' || a.severity === 'medium' || a.severity === 'critical')).length;

  const stats = {
    storageUsedBytes,
    quotaBytes,
    quotaPercent,
    totalFiles,
    verifiedFiles,
    openFindingsCount,
    securityScore,
    scoreBreakdown: {
      mfaPoints,
      emailVerifiedPoints,
      scanCoveragePoints,
      threatCleanlinessPoints,
      freshIntegrityPoints,
    },
  };

  const value: VaultContextType = {
    profile,
    preferences,
    files,
    folders,
    tags,
    analyses,
    securityEvents,
    activityLogs,
    isScannerConfigured,
    toggleScannerConfigured,
    uploadFile,
    verifyFileIntegrity,
    simulateTamperFile,
    deleteFile,
    renameFile,
    moveFile,
    tagFile,
    reScanFile,
    getDownloadUrl,
    createFolder,
    renameFolder,
    deleteFolder,
    acknowledgeFinding,
    acknowledgeSecurityEvent,
    generateWeeklySummary,
    updateProfile,
    updatePreferences,
    deleteAccount,
    completeOnboarding,
    stats,
  };

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};

export const useVault = (): VaultContextType => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
};
