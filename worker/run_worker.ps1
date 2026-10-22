param(
    [string]$RunId,
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [string]$WorkerToken = "",
    [string]$WorkerId = "worker-1",
    [string]$ImageTag = "safebox-worker:latest",
    [switch]$BuildImage,
    [switch]$LocalVerificationOnly,
    [switch]$AutoCreate,
    [switch]$AllowHostFallback
)

$ErrorActionPreference = "Stop"

Write-Host "=== SafeBox AI - Member 2 Sandbox Worker ===" -ForegroundColor Cyan

# Helper to mask secret tokens
function Mask-Token([string]$val) {
    if (-not $val) { return "(none)" }
    if ($val.Length -le 6) { return "••••••••" }
    return "$($val.Substring(0, 3))...$($val.Substring($val.Length - 3))"
}

# 1. Resolve Worker Token (CLI parameter -> $env:SAFEBOX_WORKER_TOKEN -> backend/.env -> .env)
$effectiveToken = $WorkerToken
if (-not $effectiveToken) {
    if ($env:SAFEBOX_WORKER_TOKEN) {
        $effectiveToken = $env:SAFEBOX_WORKER_TOKEN.Trim()
    } else {
        $candidateEnvFiles = @(
            (Join-Path $PSScriptRoot "..\backend\.env"),
            (Join-Path $PSScriptRoot "..\.env"),
            (Join-Path (Get-Location) "backend\.env"),
            (Join-Path (Get-Location) ".env")
        )
        foreach ($envFile in $candidateEnvFiles) {
            if (Test-Path $envFile) {
                Get-Content $envFile | ForEach-Object {
                    $line = $_.Trim()
                    if ($line -and -not $line.StartsWith("#") -and $line.StartsWith("SAFEBOX_WORKER_TOKEN=")) {
                        $parsed = $line.Substring("SAFEBOX_WORKER_TOKEN=".Length).Trim().Trim('"').Trim("'")
                        if ($parsed) {
                            $effectiveToken = $parsed
                        }
                    }
                }
                if ($effectiveToken) { break }
            }
        }
    }
}

if ($effectiveToken) {
    Write-Host "[*] Worker authentication token resolved: $(Mask-Token $effectiveToken)" -ForegroundColor Gray
} else {
    Write-Host "[!] No worker token configured (connecting in unauthenticated development mode)." -ForegroundColor Yellow
}

# 2. Build Docker image if requested
if ($BuildImage) {
    Write-Host "[*] Building Docker worker image: $ImageTag..." -ForegroundColor Yellow
    $dockerfileDir = Split-Path -Parent $PSCommandPath
    docker build -t $ImageTag -f "$dockerfileDir\Dockerfile" "$dockerfileDir"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build Docker worker image."
        exit 1
    }
    Write-Host "[+] Docker image built successfully." -ForegroundColor Green
}

# 3. Handle LocalVerificationOnly mode
$venvPython = (Join-Path $PSScriptRoot "..\backend\.venv\Scripts\python.exe")
if (-not (Test-Path $venvPython)) {
    $venvPython = "python.exe"
}
$env:PYTHONPATH = "$PSScriptRoot;$PSScriptRoot\..\backend"

if ($LocalVerificationOnly) {
    Write-Host "[*] Running local sandbox isolation verification (-LocalVerificationOnly)..." -ForegroundColor Yellow
    Write-Host "    Note: Checks will run locally on host and will NOT be submitted to backend." -ForegroundColor Gray
    
    $localWs = Join-Path $env:TEMP "safebox_local_ws"
    if (-not (Test-Path $localWs)) { New-Item -ItemType Directory -Path $localWs -Force | Out-Null }
    
    & $venvPython -m worker.main --workspace-dir $localWs
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Error "Local verification checks failed with exit code $exitCode."
        exit $exitCode
    }
    Write-Host "[+] Local verification finished successfully. (No backend submission performed)." -ForegroundColor Green
    exit 0
}

# 4. Normal Submission Mode: Ensure RunId exists or auto-create test run
if (-not $RunId) {
    if (-not $AutoCreate) {
        Write-Host "[*] No -RunId specified. Resolving most recent run from $BackendUrl..." -ForegroundColor Cyan
        try {
            $runsResp = Invoke-RestMethod -Method Get -Uri "$BackendUrl/api/security-tests/runs?limit=1" -TimeoutSec 5 -ErrorAction Stop
            if ($runsResp -and $runsResp.items -and $runsResp.items.Count -gt 0) {
                $latest = $runsResp.items[0]
                $RunId = $latest.run_id
                Write-Host "[+] Resolved latest run: $RunId ($($latest.test_id), $($latest.provider)/$($latest.model))" -ForegroundColor Green
                Write-Host "    Pass -RunId <id> to verify a specific historical run, or -AutoCreate to create a fresh test run." -ForegroundColor Gray
            }
        } catch {
            Write-Host "[!] Could not fetch runs from ${BackendUrl}: $_" -ForegroundColor Yellow
        }
    }

    if (-not $RunId) {
        Write-Host "[*] Auto-creating a security test run on $BackendUrl..." -ForegroundColor Yellow
        $body = @{ test_id = "canary-disclosure"; target = @{ mode = "mock"; mock_behavior = "defended" } } | ConvertTo-Json -Depth 5
        try {
            $runResp = Invoke-RestMethod -Method Post -Uri "$BackendUrl/api/security-tests/run" -ContentType "application/json" -Body $body
            $RunId = $runResp.run_id
            Write-Host "[+] Auto-created run: $RunId (AI evaluation status: $($runResp.result.status))" -ForegroundColor Green
        } catch {
            Write-Error "Failed to create security test run on backend at ${BackendUrl}: $_"
            exit 1
        }
    }
} else {
    Write-Host "[*] Verifying target run exists on backend: $RunId..." -ForegroundColor Gray
    try {
        $existing = Invoke-RestMethod "$BackendUrl/api/security-tests/runs/$RunId"
        Write-Host "[+] Attached to existing run: $RunId (AI evaluation status: $($existing.result.status))" -ForegroundColor Green
    } catch {
        Write-Error "Target run $RunId not found on backend (${BackendUrl}): $_"
        exit 1
    }
}

# 5. Check Docker availability
$dockerCliDir = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin"
if ((Test-Path $dockerCliDir) -and ($env:Path -notlike "*$dockerCliDir*")) {
    $env:Path = "$dockerCliDir;$env:Path"
}

$dockerInstalled = (Get-Command docker -ErrorAction SilentlyContinue) -ne $null
$dockerRunning = $false
if ($dockerInstalled) {
    docker info 2>&1 | Out-Null
    $dockerRunning = ($LASTEXITCODE -eq 0)
}

# 6. Execute orchestrator with proper argument array (never string-interpolated)
$pyArgs = @(
    "-m", "worker.orchestrator.docker_runner",
    "--run-id", $RunId,
    "--backend-url", $BackendUrl,
    "--worker-id", $WorkerId
)
if ($dockerRunning) {
    Write-Host "[*] Docker Desktop is running. Spawning hardened container for $RunId..." -ForegroundColor Green
    $pyArgs += @("--image-tag", $ImageTag)
} else {
    Write-Host "[!] Docker Desktop is offline. Falling back to host isolation verification..." -ForegroundColor Yellow
}

if ($effectiveToken) {
    $pyArgs += @("--token", $effectiveToken)
}

& $venvPython @pyArgs
$workerExitCode = $LASTEXITCODE

if ($workerExitCode -ne 0) {
    Write-Error "Worker orchestrator failed with exit code $workerExitCode. Infrastructure checks were NOT accepted by backend."
    exit $workerExitCode
}

# 7. Fetch and display updated RunRecord with infrastructure verification checks
Write-Host "`n[*] Updated run record from SafeBox backend:" -ForegroundColor Cyan
try {
    $record = Invoke-RestMethod "$BackendUrl/api/security-tests/runs/$RunId"
    Write-Host "  Run ID:                $($record.run_id)"
    Write-Host "  AI Result Status:      $($record.result.status)"
    
    $infraStatusColor = if ($record.infrastructure.status -eq "PASS") { "Green" } elseif ($record.infrastructure.status -eq "FAIL") { "Red" } else { "Yellow" }
    Write-Host "  Infrastructure Status: $($record.infrastructure.status)" -ForegroundColor $infraStatusColor
    
    $checkCount = $record.infrastructure.checks.Count
    Write-Host "  Submitted Checks:      ($checkCount/7)"
    foreach ($c in $record.infrastructure.checks) {
        $cColor = if ($c.status -eq "PASS") { "Green" } elseif ($c.status -eq "FAIL") { "Red" } else { "Yellow" }
        Write-Host "    - [$($c.status)] $($c.check_id): $($c.observed)" -ForegroundColor $cColor
        if ($c.limitation) {
            Write-Host "      Limitation: $($c.limitation)" -ForegroundColor DarkGray
        }
    }
    
    if ($checkCount -lt 7) {
        Write-Warning "Expected 7 isolation checks, but only $checkCount were submitted."
    } elseif ($record.infrastructure.status -eq "PASS") {
        Write-Host "[+] All 7 infrastructure isolation checks verified and PASSING!" -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to fetch updated run record from backend: $_"
    exit 1
}
