# SafeBox AI - Unified Development Environment Launcher
param(
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [switch]$Stop,
    [switch]$Restart
)

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "       SafeBox AI Development Launcher       " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$stopBackendScript = Join-Path $PSScriptRoot "stop_backend.ps1"
$startBackendScript = Join-Path $PSScriptRoot "start_backend.ps1"

# Handle Stop request
if ($Stop) {
    Write-Host "[*] Stopping SafeBox AI services..." -ForegroundColor Yellow
    & $stopBackendScript -Port $BackendPort
    
    # Check for frontend vite server on FrontendPort
    $frontendConn = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($frontendConn) {
        $p = Get-Process -Id $frontendConn.OwningProcess -ErrorAction SilentlyContinue
        if ($p) {
            Write-Host "[*] Stopping frontend process (PID $($p.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "[+] All SafeBox AI dev services stopped." -ForegroundColor Green
    exit 0
}

# 1. Check Python virtual environment
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    Write-Error "Backend Python virtual environment not found at $pythonExe. Run: python -m venv backend/.venv"
    exit 1
}

# 2. Check Node / npm
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Error "Node.js / npm is required to run the frontend. Please ensure npm is installed and in PATH."
    exit 1
}

# 3. Check / Start Backend
Write-Host "`n[1/3] Backend Service Check..." -ForegroundColor Yellow
$backendHealthy = $false
try {
    $h = Invoke-RestMethod -Uri "http://127.0.0.1:$BackendPort/api/health" -TimeoutSec 2 -ErrorAction Stop
    if ($h.app_name -eq "SafeBox AI") {
        $backendHealthy = $true
        Write-Host "[+] Backend is ALREADY running and healthy on http://127.0.0.1:$BackendPort (Target mode: $($h.target_mode))" -ForegroundColor Green
    }
} catch { }

if (-not $backendHealthy -or $Restart) {
    if ($Restart) {
        Write-Host "[*] Restarting backend on port $BackendPort..." -ForegroundColor Cyan
        & $startBackendScript -Restart -Background -Port $BackendPort
    } else {
        Write-Host "[*] Starting backend in background on port $BackendPort..." -ForegroundColor Cyan
        & $startBackendScript -Background -Port $BackendPort
    }
}

# 4. Check / Start Frontend
Write-Host "`n[2/3] Frontend Service Check..." -ForegroundColor Yellow
$frontendRunning = $false
$fConn = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($fConn) {
    $fProc = Get-Process -Id $fConn.OwningProcess -ErrorAction SilentlyContinue
    Write-Host "[+] Frontend Vite server is ALREADY running on http://localhost:$FrontendPort (PID $($fProc.Id))" -ForegroundColor Green
    $frontendRunning = $true
} else {
    Write-Host "[*] Starting frontend Vite dev server on http://localhost:$FrontendPort..." -ForegroundColor Cyan
    $frontendProc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c npm run dev" `
        -WorkingDirectory $frontendDir `
        -WindowStyle Hidden `
        -PassThru
    Write-Host "[*] Spawned frontend process PID $($frontendProc.Id). Waiting for readiness..." -ForegroundColor Gray
    
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Milliseconds 500
        $check = Get-NetTCPConnection -LocalPort $FrontendPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($check) {
            $frontendRunning = $true
            Write-Host "[+] Frontend is ready on http://localhost:$FrontendPort!" -ForegroundColor Green
            break
        }
    }
    if (-not $frontendRunning) {
        Write-Host "[!] Frontend started but port $FrontendPort not listening yet; check terminal logs." -ForegroundColor Yellow
    }
}

# 5. Check Ollama Engine (Optional local inference)
Write-Host "`n[3/3] Ollama Inference Engine Check..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
    $modelNames = ($tags.models | ForEach-Object { $_.name }) -join ", "
    Write-Host "[+] Ollama is active on http://127.0.0.1:11434. Models: $modelNames" -ForegroundColor Green
    $ollamaRunning = $true
} catch {
    # Attempt to locate and start local Ollama if installed
    $ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue
    $ollamaExe = if ($ollamaCmd) { $ollamaCmd.Source } else { Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe" }
    if (Test-Path $ollamaExe) {
        Write-Host "[*] Ollama executable found at $ollamaExe. Starting local background service ('ollama serve')..." -ForegroundColor Cyan
        Start-Process -FilePath $ollamaExe -ArgumentList "serve" -WindowStyle Hidden
        for ($i = 0; $i -lt 8; $i++) {
            Start-Sleep -Milliseconds 500
            try {
                $tags = Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 1 -ErrorAction Stop
                $modelNames = ($tags.models | ForEach-Object { $_.name }) -join ", "
                Write-Host "[+] Ollama started successfully on http://127.0.0.1:11434. Models: $modelNames" -ForegroundColor Green
                $ollamaRunning = $true
                break
            } catch { }
        }
    }
    if (-not $ollamaRunning) {
        Write-Host "[!] Ollama is not running on http://127.0.0.1:11434." -ForegroundColor Yellow
        Write-Host "    Prerequisite: Install Ollama (https://ollama.com) and run 'ollama serve' to enable local LLM evaluations." -ForegroundColor Gray
    }
}

# Summary
Write-Host "`n==============================================" -ForegroundColor Cyan
Write-Host "       SafeBox AI Services Are Ready!        " -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Dashboard: http://localhost:$FrontendPort" -ForegroundColor White
Write-Host "  API Docs:  http://127.0.0.1:$BackendPort/docs" -ForegroundColor White
Write-Host "  Health:    http://127.0.0.1:$BackendPort/api/health" -ForegroundColor White
Write-Host "`nUseful commands:" -ForegroundColor Gray
Write-Host "  Verify Sandbox: .\scripts\verify_run.ps1 [-RunId <id>]" -ForegroundColor Gray
Write-Host "  Stop Services:  .\scripts\dev.ps1 -Stop" -ForegroundColor Gray
Write-Host "  Restart:        .\scripts\dev.ps1 -Restart`n" -ForegroundColor Gray
