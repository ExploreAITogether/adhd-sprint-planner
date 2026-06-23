[CmdletBinding()]
param(
    [string]$ShortcutName = "Deploy ADHD Sprint Planner"
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$deployScript = Join-Path $repoRoot "scripts\deploy-windows.ps1"
$iconPath = Join-Path $repoRoot "src-tauri\icons\icon.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "$ShortcutName.lnk"

if (-not (Test-Path $deployScript)) {
    throw "Deploy script was not found: $deployScript"
}

$powershellPath = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path $powershellPath)) {
    throw "Windows PowerShell was not found at $powershellPath"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershellPath
$shortcut.Arguments = "-NoExit -ExecutionPolicy Bypass -File `"$deployScript`" -Pull"
$shortcut.WorkingDirectory = $repoRoot

if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()

Write-Host "Created Desktop shortcut:" -ForegroundColor Green
Write-Host "  $shortcutPath"
