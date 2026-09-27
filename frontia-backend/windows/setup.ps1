$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'run.ps1'
$tailscale = Get-Command tailscale.exe -ErrorAction SilentlyContinue
if (-not $tailscale) {
  $fallback = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
  if (Test-Path $fallback) { $tailscale = Get-Command $fallback }
}
if (-not (Get-Command node.exe -ErrorAction SilentlyContinue) -or -not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22+ from https://nodejs.org/ then open a NEW PowerShell window.' }
if (-not $tailscale) { throw 'Install and sign in to Tailscale on this PC from https://tailscale.com/download/windows then run this script again.' }
$major = [int]((& node.exe -p 'process.versions.node.split(".")[0]').Trim())
if ($major -lt 22) { throw 'Node.js 22 or later is required.' }
$npmRoot = (& npm.cmd root -g).Trim()
if ($LASTEXITCODE -ne 0) { throw 'npm is unavailable.' }
$codexEntry = Join-Path $npmRoot '@openai\codex\bin\codex.js'
if (-not (Test-Path $codexEntry)) {
  & npm.cmd install --global '@openai/codex@0.155.1'
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $codexEntry)) { throw 'Codex CLI installation failed.' }
}
$secretDir = Join-Path $env:LOCALAPPDATA 'CinematicPlay'
$secret = Join-Path $secretDir 'backend-password.txt'
if (-not (Test-Path $secret)) {
  $secure = Read-Host 'Create a private backend password (at least 16 characters)' -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { if ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr).Length -lt 16) { throw 'Password must have at least 16 characters.' } }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
  New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
  try { $secure | ConvertFrom-SecureString | Set-Content -Path $secret -NoNewline }
  finally { $secure.Dispose() }
  Write-Host 'Password saved with Windows user encryption; keep it for entering once on each browser.'
}
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'Cinematic Play Backend.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = (Get-Command powershell.exe).Source
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $runner + '"'
$shortcut.WorkingDirectory = $backend
$shortcut.WindowStyle = 7
$shortcut.Description = 'Start the personal Cinematic Play backend after Windows sign-in'
$shortcut.Save()
if (-not (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $runner + '"')) -WindowStyle Minimized
}
$ready = $false
for ($i = 0; $i -lt 25; $i++) {
  try { $health = Invoke-RestMethod 'http://127.0.0.1:8000/health' -TimeoutSec 1; if ($health.ok -eq $true) { $ready = $true; break } } catch { Start-Sleep -Milliseconds 400 }
}
if (-not $ready) { throw 'Backend did not start. Run windows/run.ps1 in a PowerShell window to see the error.' }
Write-Host 'Backend is running. Tailscale may open a browser to approve Funnel once.'
& $tailscale.Source funnel --bg http://127.0.0.1:8000
if ($LASTEXITCODE -ne 0) { throw 'Funnel could not start. Check Tailscale login and Funnel approval.' }
Write-Host 'Public Funnel address:'
$funnelStatus = (& $tailscale.Source funnel status | Out-String)
Write-Host $funnelStatus
$address = [regex]::Match($funnelStatus, 'https://[a-zA-Z0-9.-]+\.ts\.net(?::[0-9]+)?')
if ($address.Success) {
  $configPath = Join-Path (Split-Path -Parent $backend) 'frontia\backend-config.json'
  $json = @{ backendUrl = $address.Value } | ConvertTo-Json
  [IO.File]::WriteAllText($configPath, ($json + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
  Write-Host "Frontend configuration written: $configPath"
  Write-Host 'This file must be published to GitHub Pages before new devices discover the address automatically.'
} else {
  Write-Host 'Copy your https://....ts.net address into frontia/backend-config.json and publish the file.'
}
Write-Host 'Share ONLY the Funnel URL (never your password) if you want help publishing the configuration.'
