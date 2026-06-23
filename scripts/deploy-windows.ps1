[CmdletBinding()]
param(
    [switch]$Pull,
    [switch]$SkipInstall,
    [string]$OutputDir
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,
        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Command
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not $OutputDir) {
    $OutputDir = Join-Path ([Environment]::GetFolderPath("Desktop")) "ADHD Sprint Planner"
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js, then run this again."
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw "cargo was not found. Install Rust, then run this again."
}

if ($Pull) {
    Invoke-Step "Pull latest Git changes" {
        git pull --ff-only
    }
}

if (-not (Test-Path (Join-Path $repoRoot ".env"))) {
    Write-Warning ".env was not found. Create it from .env.example and set VITE_GEMINI_API_KEY before building a usable release."
}

if (-not $SkipInstall) {
    Invoke-Step "Install npm dependencies" {
        npm install
    }
}

Invoke-Step "Build Windows release" {
    npm run tauri build
}

Invoke-Step "Collect release files" {
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

    $releaseRoot = Join-Path $repoRoot "src-tauri\target\release"
    $candidateFiles = @()

    $candidateFiles += Get-ChildItem -Path $releaseRoot -Filter "*.exe" -File -ErrorAction SilentlyContinue
    $candidateFiles += Get-ChildItem -Path (Join-Path $releaseRoot "bundle\msi") -Filter "*.msi" -File -ErrorAction SilentlyContinue
    $candidateFiles += Get-ChildItem -Path (Join-Path $releaseRoot "bundle\nsis") -Filter "*.exe" -File -ErrorAction SilentlyContinue

    if (-not $candidateFiles -or $candidateFiles.Count -eq 0) {
        throw "No Windows release artifacts were found under $releaseRoot."
    }

    $copied = @()
    foreach ($file in $candidateFiles) {
        $destination = Join-Path $OutputDir $file.Name
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $copied += $destination
    }

    Write-Host ""
    Write-Host "Copied release files to:" -ForegroundColor Green
    Write-Host "  $OutputDir"
    foreach ($path in $copied) {
        Write-Host "  - $path"
    }
}

Write-Host ""
Write-Host "Done. You can close this window." -ForegroundColor Green
