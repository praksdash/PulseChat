$ErrorActionPreference = "Stop"

Write-Host "PulseChat Phase 15 preview preflight" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Fail([string]$message) {
    Write-Host "" 
    Write-Host "ERROR: $message" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".env")) {
    Fail "Missing .env. Copy .env.example to .env and add your Supabase URL and publishable key."
}

$envLines = Get-Content ".env"
$requiredNames = @(
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
)

$publicValues = @{}
foreach ($name in $requiredNames) {
    $match = $envLines | Where-Object {
        $_ -match "^\s*$([regex]::Escape($name))\s*="
    } | Select-Object -Last 1

    if (-not $match) {
        Fail "Missing $name in .env."
    }

    $value = ($match -split "=", 2)[1].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace($value) -or $value -match "YOUR_|REPLACE_ME|placeholder") {
        Fail "$name still contains an empty/placeholder value."
    }
    $publicValues[$name] = $value
}

if ($publicValues["EXPO_PUBLIC_SUPABASE_URL"] -notmatch '^https://.+\.supabase\.co/?$') {
    Write-Host "WARNING: EXPO_PUBLIC_SUPABASE_URL does not look like the normal https://<project>.supabase.co form." -ForegroundColor Yellow
}

if (-not (Test-Path "google-services.json")) {
    Fail "Missing google-services.json at the PulseChat project root. Download it from the Firebase Android app for com.prakashdash.pulsechat."
}

try {
    $googleServices = Get-Content "google-services.json" -Raw | ConvertFrom-Json
    $packages = @($googleServices.client | ForEach-Object { $_.client_info.android_client_info.package_name })
    if ($packages -notcontains "com.prakashdash.pulsechat") {
        Fail "google-services.json does not contain Android package com.prakashdash.pulsechat."
    }
} catch {
    Fail "google-services.json could not be parsed: $($_.Exception.Message)"
}

Write-Host "[1/6] Firebase Android config looks correct." -ForegroundColor Green

Write-Host "[2/6] Aligning Expo dependency versions and package-lock.json..." -ForegroundColor Cyan
& npx expo install expo-notifications
if ($LASTEXITCODE -ne 0) { Fail "expo-notifications installation/version alignment failed." }

& npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm install failed while synchronizing package-lock.json." }

Write-Host "[3/6] Verifying that npm ci (the command EAS uses) can install this lockfile..." -ForegroundColor Cyan
& npm ci --include=dev --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Fail "npm ci failed. package.json/package-lock.json are still not synchronized." }

Write-Host "[4/6] Running Expo compatibility checks..." -ForegroundColor Cyan
& npx expo install --check
if ($LASTEXITCODE -ne 0) { Fail "Expo dependency check failed." }

& npx expo-doctor
if ($LASTEXITCODE -ne 0) { Fail "expo-doctor reported a blocking problem. Review its output before building." }

$tempEnv = Join-Path $projectRoot ".phase15-eas-preview.env"
try {
    @(
        "EXPO_PUBLIC_SUPABASE_URL=$($publicValues['EXPO_PUBLIC_SUPABASE_URL'])",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$($publicValues['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])"
    ) | Set-Content -Path $tempEnv -Encoding utf8

    Write-Host "[5/6] Uploading the two client-safe Supabase variables to the EAS preview environment..." -ForegroundColor Cyan
    & eas env:push preview --path $tempEnv --force
    if ($LASTEXITCODE -ne 0) { Fail "Unable to push EAS preview environment variables. Run eas login, then retry." }
} finally {
    if (Test-Path $tempEnv) { Remove-Item $tempEnv -Force }
}

Write-Host "[6/6] Preview environment summary:" -ForegroundColor Cyan
& eas env:list --environment preview
if ($LASTEXITCODE -ne 0) { Fail "Unable to list EAS preview variables." }

Write-Host ""
Write-Host "PREVIEW PREPARATION PASSED" -ForegroundColor Green
Write-Host "Now run:" -ForegroundColor White
Write-Host "  eas build --platform android --profile preview" -ForegroundColor Yellow
Write-Host ""
Write-Host "Important: EXPO_PUBLIC_* values are intentionally client-visible. Never put service_role, Supabase secret keys, Firebase service-account JSON, Expo access tokens, or PUSH_WEBHOOK_SECRET in .env." -ForegroundColor DarkGray
