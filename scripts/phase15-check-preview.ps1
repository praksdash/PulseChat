$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "Checking PulseChat Phase 15 preview configuration..." -ForegroundColor Cyan

$failed = $false

if (-not (Test-Path ".env")) {
  Write-Host "FAIL  .env is missing" -ForegroundColor Red
  $failed = $true
} else {
  foreach ($name in @("EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY")) {
    if (Select-String -Path ".env" -Pattern "^\s*$([regex]::Escape($name))\s*=\s*.+" -Quiet) {
      Write-Host "PASS  $name exists in local .env" -ForegroundColor Green
    } else {
      Write-Host "FAIL  $name is missing from local .env" -ForegroundColor Red
      $failed = $true
    }
  }
}

if (Test-Path "google-services.json") {
  Write-Host "PASS  google-services.json exists" -ForegroundColor Green
} else {
  Write-Host "FAIL  google-services.json is missing" -ForegroundColor Red
  $failed = $true
}

Write-Host ""
Write-Host "EAS preview variables:" -ForegroundColor Cyan
& eas env:list --environment preview
if ($LASTEXITCODE -ne 0) { $failed = $true }

if ($failed) { exit 1 }
Write-Host "Basic Phase 15 preview configuration looks ready." -ForegroundColor Green
