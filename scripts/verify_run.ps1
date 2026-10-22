# SafeBox AI - Run Infrastructure Verification Helper
param(
    [string]$RunId,
    [string]$BackendUrl = "http://127.0.0.1:8000",
    [switch]$AllowHostFallback,
    [switch]$AutoCreate,
    [switch]$BuildImage
)

$ErrorActionPreference = "Stop"

$workerScript = Join-Path $PSScriptRoot "..\worker\run_worker.ps1"

$argsList = @{
    BackendUrl = $BackendUrl
}

if ($RunId) { $argsList["RunId"] = $RunId }
if ($AllowHostFallback) { $argsList["AllowHostFallback"] = $true }
if ($AutoCreate) { $argsList["AutoCreate"] = $true }
if ($BuildImage) { $argsList["BuildImage"] = $true }

& $workerScript @argsList
