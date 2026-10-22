# SafeBox AI - Worker Authentication Token Setup & Rotation Script
param(
    [switch]$Rotate,
    [switch]$Clear
)

$ErrorActionPreference = "Stop"

function Mask-Token([string]$val) {
    if (-not $val) { return "(none)" }
    if ($val.Length -le 6) { return "••••••••" }
    return "$($val.Substring(0, 3))...$($val.Substring($val.Length - 3))"
}

$backendEnvPath = Join-Path $PSScriptRoot "..\backend\.env"

if ($Clear) {
    if (Test-Path $backendEnvPath) {
        $lines = Get-Content $backendEnvPath | Where-Object { -not $_.StartsWith("SAFEBOX_WORKER_TOKEN=") }
        Set-Content -Path $backendEnvPath -Value $lines -Encoding utf8
    }
    Remove-Item env:SAFEBOX_WORKER_TOKEN -ErrorAction SilentlyContinue
    Write-Host "[+] Worker authentication disabled (token cleared from backend/.env)." -ForegroundColor Yellow
    Write-Host "    Restart backend to apply: .\scripts\start_backend.ps1 -Restart" -ForegroundColor Gray
    exit 0
}

# Check if token already exists in backend/.env
$existingToken = $null
if (Test-Path $backendEnvPath) {
    Get-Content $backendEnvPath | ForEach-Object {
        $line = $_.Trim()
        if ($line.StartsWith("SAFEBOX_WORKER_TOKEN=")) {
            $parsed = $line.Substring("SAFEBOX_WORKER_TOKEN=".Length).Trim().Trim('"').Trim("'")
            if ($parsed) { $existingToken = $parsed }
        }
    }
}

if ($existingToken -and (-not $Rotate)) {
    $env:SAFEBOX_WORKER_TOKEN = $existingToken
    Write-Host "[*] SafeBox AI worker token is already configured in backend/.env: $(Mask-Token $existingToken)" -ForegroundColor Green
    Write-Host "    Environment variable `$env:SAFEBOX_WORKER_TOKEN set for this session." -ForegroundColor Gray
    Write-Host "    To generate a new token, run with -Rotate." -ForegroundColor Gray
    exit 0
}

# Generate a cryptographically secure 256-bit token
$randomBytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($randomBytes)
$newToken = [Convert]::ToBase64String($randomBytes)
$rng.Dispose()

# Save token into backend/.env
$content = @()
$tokenSet = $false
if (Test-Path $backendEnvPath) {
    $lines = Get-Content $backendEnvPath
    foreach ($line in $lines) {
        if ($line.Trim().StartsWith("SAFEBOX_WORKER_TOKEN=")) {
            $content += "SAFEBOX_WORKER_TOKEN=$newToken"
            $tokenSet = $true
        } else {
            $content += $line
        }
    }
}

if (-not $tokenSet) {
    $content += "SAFEBOX_WORKER_TOKEN=$newToken"
}

Set-Content -Path $backendEnvPath -Value $content -Encoding utf8
$env:SAFEBOX_WORKER_TOKEN = $newToken

$action = if ($Rotate) { "Rotated" } else { "Generated" }
Write-Host "[+] $action cryptographically secure worker token: $(Mask-Token $newToken)" -ForegroundColor Green
Write-Host "    Saved securely to backend/.env (gitignored)." -ForegroundColor Gray
Write-Host "    Environment variable `$env:SAFEBOX_WORKER_TOKEN set in current session." -ForegroundColor Gray
Write-Host "    IMPORTANT: Restart the backend to load the new token:" -ForegroundColor Cyan
Write-Host "    .\scripts\start_backend.ps1 -Restart" -ForegroundColor Cyan
