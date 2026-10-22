# SafeBox AI — Specification & Architecture

## 1. Product Definition
SafeBox AI is a security-focused private file vault with a built-in security analyst. It provides individual users with high-assurance file storage, tamper-evident cryptographic integrity monitoring, static security verification, external malware scanner adapter lookups, and plain-language advisory AI explanations.

### Core Product Parameters
- **Account Type**: Single-user accounts only (no teams, organizations, or shared spaces in v1).
- **Billing Model**: No billing or pricing section in v1. The landing page shows a **"Free during beta"** note.
- **Quotas**:
  - Account storage quota: **1 GB (1,073,741,824 bytes)** total per account.
  - Per-file size limit: **25 MB (26,214,400 bytes)** maximum.
- **Target Audience**: Freelancers, consultants, and privacy-conscious professionals storing sensitive contracts, tax records, identification scans, source archives, and financial statements.

---

## 2. Non-Negotiable Honesty & Security Rules
1. **No Fake Scan Results or Fabricated Metrics**: Never return invented clean results, dummy malware verdicts, or deceptive metrics. If a scanner or AI key is not configured, return status `"unconfigured"` with a setup card naming the exact secret required.
2. **Never Claim a File is "Safe"**: The strongest positive verification statement is:
   > *"No threats detected by the engines that were run."*
   An AI/LLM model never decides malware detection; it only explains findings from deterministic static checks and certified malware scanning engines.
3. **No False Encryption Claims**: Never claim "end-to-end encryption", "zero-knowledge storage", or "military-grade 100% security". 
   - **Actual Security Model**: TLS in transit, provider-managed AES-256 at rest, private bucket storage, server-side hashing and static analysis. The server must access file bytes during upload to calculate hashes and perform magic-byte verification.
4. **Advisory AI Boundary**: All AI outputs are labeled **"Advisory"** with the mandatory disclaimer:
   > *"Advisory: AI explanations can be wrong and are not a malware verdict."*
   The AI cannot alter file severity, status, or access permissions.
5. **No Secrets in Frontend / Browser**: API keys (`VIRUSTOTAL_API_KEY`, `AI_API_KEY`, service-role keys) are strictly server-side secrets. Never exposed in repository code, client bundles, or logs.
6. **No Injected HTML**: Never use `dangerouslySetInnerHTML` for file contents or AI explanations. File previews for plain text and markdown are rendered safely as escaped plain text or controlled previews.
7. **Trust & Verifiability**: No fabricated enterprise logos, false compliance badges (SOC 2, ISO 27001, HIPAA), or invented testimonials.

---

## 3. Technical Architecture & Tech Stack

### Frontend Stack
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Custom Design System Tokens (Dark Theme Default)
- **Icons**: `lucide-react`
- **Charts**: `recharts` (Area chart for uploads over time, Bar chart for findings by severity)
- **3D Hero Scene**: `@react-three/fiber` (v8) + `@react-three/drei` (v9) + `three.js` (v0.165), lazy-loaded after first paint with static SVG/CSS-3D poster fallback
- **State & Data Fetching**: TanStack Query / React Hooks with optimistic updates
- **Client Cryptography**: Web Crypto API (`crypto.subtle.digest('SHA-256', ...)`)

### Backend & Cloud Architecture (Lovable Cloud / Supabase)
- **Auth**: Email + password, email verification, password reset, session persistence, optional TOTP MFA enrollment & challenge.
- **Postgres Database**: Row Level Security (RLS) on every table enforcing `user_id = auth.uid()`.
- **Storage Bucket**: Private bucket `"vault"` (public = false, 25 MB limit). Storage path is strictly `{user_id}/{file_id}`. User filename is never used in storage paths.
- **Edge Functions (Deno)**:
  - `finalize-upload`: Validates owner, file existence, size, magic bytes vs claimed MIME, recomputes SHA-256 server-side, transitions status.
  - `analyze-file`: Executes deterministic static checks, calls ScannerAdapter (VirusTotal), invokes server-side AI explainer.
  - `verify-integrity`: Re-streams object from storage, computes SHA-256, compares against recorded hash, logs security event on mismatch.
  - `get-download-url`: Owner check, refuses blocked files, requires confirmation for flagged files, generates short-lived 60-second signed download URL.
  - `delete-file`: Marks status `deleting`, removes storage object, removes database record, logs audit event.
  - `summarize-security-events`: Aggregates metadata of recent security events and generates an advisory AI digest.
  - `delete-account`: Deletes all user objects in storage, table rows, and authentication user after typed `"DELETE"` confirmation.

---

## 4. Upload Data Flow
1. **Client Selection & Pre-Validation**: User drags/selects a file. Client validates file size ($\le 25\text{ MB}$), checks allowed extension, checks for double extension anomalies (e.g. `invoice.pdf.exe`), and checks for control/bidi characters.
2. **Client-Side Hashing**: Browser computes SHA-256 hash using Web Crypto API.
3. **RPC `create_upload`**: Client sends metadata (`name`, `size`, `mime`, `sha256`, `folder_id`). Database RPC verifies user quota, rate limits, and inserts a `files` row with status `pending_upload`. Returns `file_id` and `storage_path`.
4. **Direct Bucket Upload**: Client uploads directly to `vault/{user_id}/{file_id}`.
5. **Edge Function `finalize-upload`**:
   - Confirms storage object exists and size matches.
   - Reads header bytes to verify magic bytes against claimed MIME type.
   - Recomputes SHA-256 server-side; if hash mismatch or spoofed type detected, sets status to `rejected`, deletes object, and logs security event.
   - If valid, updates status to `scanning` and triggers `analyze-file`.
6. **Edge Function `analyze-file`**:
   - Runs static checks (archive flag, macro-capable Office formats, script markers in text, size anomalies).
   - Scanner Adapter: performs VirusTotal SHA-256 hash lookup (file contents never leave storage by default).
   - AI Explainer: receives sanitized metadata and scanner output; produces structured plain-English advisory report.
   - Sets status to `ready` (clean/info), `flagged` (medium/high risk), or `blocked` (2+ engines report malicious or critical static threat).

---

## 5. File Statuses
- `pending_upload`: Record created; waiting for file bytes to upload to vault.
- `scanning`: Upload confirmed; static checks, hash lookup, and AI analysis in progress.
- `ready`: Scans complete; no threats detected or only informational notices. Download permitted.
- `flagged`: Suspicious traits or single-engine detection found. Requires explicit risk acknowledgement dialog before download.
- `blocked`: Multi-engine malicious detection or critical static violation. Download and preview are permanently disabled; delete remains available.
- `rejected`: Type spoofing or client/server hash mismatch detected during finalization; file automatically removed.
- `analysis_failed`: External scanner or analysis engine error; safe retry allowed.
- `deleting`: Deletion in progress (removing storage object then database record).

---

## 6. Allowed & Blocked File Types
### Allowed Types (v1)
- **Documents**: `pdf`, `txt`, `md`, `csv`, `docx`, `xlsx`, `pptx`
- **Images**: `png`, `jpg`, `jpeg`, `webp`, `gif` (SVG is blocked due to script execution risk)
- **Archives**: `zip` (stored, hashed, scanned, flagged for manual review; never extracted or previewed)

### Blocked Types
- Executables & Scripts: `exe`, `dll`, `msi`, `bat`, `cmd`, `com`, `scr`, `ps1`, `vbs`, `js`, `sh`, `jar`, `apk`, `app`, `dmg`
- Script-bearing web formats: `html`, `htm`, `svg`
- Malformed names: Double extensions (e.g. `report.pdf.exe`), control characters, or bidirectional Unicode overrides.

---

## 7. Account Security Score Formula (0–100 Deterministic)
The account security score is computed strictly from verified inputs without invented metrics:
1. **MFA Enabled**: **25 points** (0 if disabled)
2. **Email Verified**: **10 points** (0 if unverified)
3. **Scan Coverage**: Up to **25 points** (Proportional: $\frac{\text{files with completed scan}}{\text{total files}} \times 25$)
4. **Threat Cleanliness**: **25 points** if zero unresolved high or critical findings exist (0 points if any exist)
5. **Fresh Integrity Verification**: Up to **15 points** (Proportional: $\frac{\text{files verified within last 30 days}}{\text{total files}} \times 15$)
- **Total Maximum Score**: **100 points**
- Score Tier: 90–100 Excellent, 75–89 Good, 50–74 Moderate, < 50 Needs Attention.

---

## 8. Design System Specification
- **Theme**: Dark Theme Default
- **Palette**:
  - `--bg-0`: `#05070D` (Page background)
  - `--bg-1`: `#0A1022` (Midnight navy panels)
  - `--bg-2`: `#121826` (Graphite cards)
  - `--bg-3`: `#1A2236` (Raised surfaces & inputs)
  - `--border`: `rgba(148, 163, 184, 0.14)` (Hairline dividers)
  - `--text-1`: `#E6EBF5` (Primary typography)
  - `--text-2`: `#9AA6BD` (Secondary typography, 4.5:1 contrast)
  - `--accent`: `#22D3EE` (Primary cyan)
  - `--accent-2`: `#3B82F6` (Electric blue)
  - `--ok`: `#34D399` (Emerald verified)
  - `--warn`: `#FBBF24` (Amber medium)
  - `--danger`: `#F87171` (Red high)
  - `--critical`: `#FB7185` (Crimson critical)
- **Typography**: Sora (headings), Inter (body), JetBrains Mono (hashes, IDs, storage paths).
- **Brand Mark**: "The Core" — Faceted hexagonal vault door mark with glowing cyan center.
