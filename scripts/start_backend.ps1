# SafeBox AI - Development Backend Startup & Port Handler Script
param(
    [switch]$Restart,
    [switch]$Background,
    [int]$Port = 8000,
    [string]$BindHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

Write-Host "=== SafeBox AI - Backend Startup ===" -ForegroundColor Cyan

$backendDir = Join-Path $PSScriptRoot "..\backend"
$stopScript = Join-Path $PSScriptRoot "stop_backend.ps1"

# Check if port is occupied
$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if ($conn) {
    $procId = $conn.OwningProcess
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue

    # Check if existing listener is SafeBox AI
    $isSafeBox = $false
    $health = $null
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3 -ErrorAction Stop
        if ($health.app_name -eq "SafeBox AI") {
            $isSafeBox = $true
        }
    } catch {
        if ($proc.Path -like "*python*" -and $proc.CommandLine -like "*app.main:app*") {
            $isSafeBox = $true
        }
    }

    if (-not $isSafeBox) {
        Write-Error "Port $Port is occupied by an unrelated process (PID $procId, '$($proc.ProcessName)'). SafeBox AI will not kill foreign processes. Free port $Port or change port to proceed."
        exit 1
    }

    if ($Restart) {
        Write-Host "[*] Restart requested. Stopping existing SafeBox AI instance (PID $procId)..." -ForegroundColor Yellow
        & $stopScript -Port $Port
    } else {
        Write-Host "[+] SafeBox AI backend is ALREADY running and healthy (PID $procId)." -ForegroundColor Green
        Write-Host "    Liveness URL:   http://127.0.0.1:$Port/api/health" -ForegroundColor Gray
        Write-Host "    Target Mode:    $($health.target_mode)" -ForegroundColor Gray
        Write-Host "    Environment:    $($health.environment)" -ForegroundColor Gray
        Write-Host "    Note: If you rotated tokens or edited configuration, restart the backend:" -ForegroundColor Yellow
        Write-Host "    .\scripts\start_backend.ps1 -Restart" -ForegroundColor Yellow
        exit 0
    }
}

# Resolve Python from backend virtual environment
$pythonExe = Join-Path $backendDir ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = "python.exe"
}

Write-Host "[*] Starting SafeBox AI FastAPI backend on http://${BindHost}:${Port}..." -ForegroundColor Yellow

if ($Background) {
    $proc = Start-Process -FilePath $pythonExe `
        -ArgumentList "-m uvicorn app.main:app --host $BindHost --port $Port --reload" `
        -WorkingDirectory (Resolve-Path $backendDir).Path `
        -WindowStyle Hidden `
        -PassThru
    Write-Host "[*] Spawned backend process with PID $($proc.Id). Waiting for liveness check..." -ForegroundColor Gray
    
    $started = $false
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 2 -ErrorAction Stop
            if ($h.app_name -eq "SafeBox AI") {
                $started = $true
                $health = $h
                break
            }
        } catch { }
    }
    
    if ($started) {
        Write-Host "[+] SafeBox AI backend started successfully (PID $($proc.Id))!" -ForegroundColor Green
        Write-Host "    Liveness URL:  http://127.0.0.1:$Port/api/health" -ForegroundColor Cyan
        Write-Host "    Target Mode:   $($health.target_mode)" -ForegroundColor Cyan
        Write-Host "    Database:      OK ($($health.database_ok))" -ForegroundColor Cyan
        if ($health.ollama) {
            $olReachable = if ($health.ollama.reachable) { "Active ($($health.ollama.configured_model))" } else { "Offline (start 'ollama serve' for local models)" }
            Write-Host "    Ollama:        $olReachable" -ForegroundColor Cyan
        }
        exit 0
    } else {
        Write-Error "Backend failed to respond to /api/health within 10 seconds."
        exit 1
    }
} else {
    Push-Location $backendDir
    try {
        & $pythonExe -m uvicorn app.main:app --host $BindHost --port $Port --reload
    } finally {
        Pop-Location
    }
}
