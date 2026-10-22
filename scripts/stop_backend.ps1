# SafeBox AI - Graceful Backend Process Terminator
param(
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"

Write-Host "=== SafeBox AI - Stop Backend ===" -ForegroundColor Cyan

$conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

if (-not $conn) {
    Write-Host "[*] Port $Port is not in use. Backend is not running." -ForegroundColor Green
    exit 0
}

$procId = $conn.OwningProcess
$proc = Get-Process -Id $procId -ErrorAction SilentlyContinue

# Verify whether the listener is actually SafeBox AI
$isSafeBox = $false
try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3 -ErrorAction Stop
    if ($health.app_name -eq "SafeBox AI") {
        $isSafeBox = $true
    }
} catch {
    # If endpoint does not respond with SafeBox app_name, check process path/commandline
    if ($proc.Path -like "*python*" -and $proc.CommandLine -like "*app.main:app*") {
        $isSafeBox = $true
    }
}

if (-not $isSafeBox) {
    Write-Error "Port $Port is occupied by PID $procId ($($proc.ProcessName)), which is NOT confirmed to be SafeBox AI. Aborting to protect unrelated processes."
    exit 1
}

Write-Host "[*] Stopping SafeBox AI backend (PID $procId)..." -ForegroundColor Yellow
Stop-Process -Id $procId -Force

# Wait for port to be freed
$freed = $false
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Milliseconds 300
    $check = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $check) {
        $freed = $true
        break
    }
}

if ($freed) {
    Write-Host "[+] SafeBox AI backend process (PID $procId) stopped. Port $Port is free." -ForegroundColor Green
} else {
    Write-Warning "Process stopped, but port $Port is still in TIME_WAIT or occupied."
}
