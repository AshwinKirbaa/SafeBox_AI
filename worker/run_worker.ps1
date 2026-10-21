# SafeBox AI - Member 2 Worker Runner Script for Windows PowerShell
param(
    [string]$RunId,
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [string]$WorkerToken = "",
    [string]$WorkerId = "worker-1",
    [string]$ImageTag = "safebox-worker:latest",
    [switch]$BuildImage,
    [switch]$LocalVerificationOnly
)

$ErrorActionPreference = "Stop"

Write-Host "=== SafeBox AI - Member 2 Sandbox Worker ===" -ForegroundColor Cyan

# 1. Build Docker image if requested
if ($BuildImage) {
    Write-Host "[*] Building Docker worker image: $ImageTag..." -ForegroundColor Yellow
    docker build -t $ImageTag -f "d:\Projects\SafeBox ai\safebox-ai\worker\Dockerfile" "d:\Projects\SafeBox ai\safebox-ai\worker"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build Docker worker image."
        exit 1
    }
    Write-Host "[+] Docker image built successfully." -ForegroundColor Green
}

# 2. If no RunId is provided, trigger a security test run via backend to obtain one
if (-not $RunId) {
    Write-Host "[*] No RunId specified. Triggering a test run on $BackendUrl..." -ForegroundColor Yellow
    $body = @{ test_id = "canary-disclosure"; target = @{ mode = "mock"; mock_behavior = "defended" } } | ConvertTo-Json -Depth 5
    $runResp = Invoke-RestMethod -Method Post -Uri "$BackendUrl/api/security-tests/run" -ContentType "application/json" -Body $body
    $RunId = $runResp.run_id
    Write-Host "[+] Created run: $RunId (AI evaluation status: $($runResp.result.status))" -ForegroundColor Green
}

# 3. Check Docker status
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

$venvPython = "d:\Projects\SafeBox ai\safebox-ai\backend\.venv\Scripts\python.exe"
$env:PYTHONPATH = "d:\Projects\SafeBox ai\safebox-ai\worker"

if ($dockerRunning -and (-not $LocalVerificationOnly)) {
    Write-Host "[*] Docker Desktop is running. Launching hardened sandbox container for $RunId..." -ForegroundColor Green
    & $venvPython -m worker.orchestrator.docker_runner `
        --run-id $RunId `
        --backend-url $BackendUrl `
        --worker-id $WorkerId `
        --image-tag $ImageTag `
        $(if ($WorkerToken) { "--token $WorkerToken" })
} else {
    Write-Host "[!] Docker Desktop is not currently running (or -LocalVerificationOnly specified)." -ForegroundColor Yellow
    Write-Host "    Running host fallback isolation verification and reporting UNAVAILABLE / FAIL checks..." -ForegroundColor Yellow
    & $venvPython -m worker.orchestrator.docker_runner `
        --run-id $RunId `
        --backend-url $BackendUrl `
        --worker-id $WorkerId `
        $(if ($WorkerToken) { "--token $WorkerToken" })
}

# 4. Fetch and display updated RunRecord with infrastructure checks
Write-Host "`n[*] Updated run record from SafeBox backend:" -ForegroundColor Cyan
$record = Invoke-RestMethod "$BackendUrl/api/security-tests/runs/$RunId"
Write-Host "  Run ID:                $($record.run_id)"
Write-Host "  AI Result Status:      $($record.result.status)"
Write-Host "  Infrastructure Status: $($record.infrastructure.status)" -ForegroundColor $(if ($record.infrastructure.status -eq "PASS") { "Green" } elseif ($record.infrastructure.status -eq "FAIL") { "Red" } else { "Yellow" })
Write-Host "  Submitted Checks:"
foreach ($c in $record.infrastructure.checks) {
    Write-Host "    - [$($c.status)] $($c.check_id): $($c.observed)"
    if ($c.limitation) {
        Write-Host "      Limitation: $($c.limitation)" -ForegroundColor DarkGray
    }
}
