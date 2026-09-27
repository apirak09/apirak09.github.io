$ErrorActionPreference = 'Stop'
$backend = Split-Path -Parent $PSScriptRoot
$secret = Join-Path $env:LOCALAPPDATA 'CinematicPlay\backend-password.txt'
if (-not (Test-Path $secret)) { throw 'Run windows/setup.ps1 before starting the backend.' }
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npmRoot = (& npm.cmd root -g).Trim()
if ($LASTEXITCODE -ne 0) { throw 'npm global directory unavailable.' }
$codexEntry = Join-Path $npmRoot '@openai\codex\bin\codex.js'
if (-not (Test-Path $codexEntry)) { throw 'Codex CLI is missing. Run windows/setup.ps1 again.' }
$secure = Get-Content $secret -Raw | ConvertTo-SecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $env:APP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secure.Dispose() }
$env:ALLOWED_ORIGIN = 'https://apirak09.github.io'
$env:HOST = '127.0.0.1'
$env:PORT = '8000'
$env:CODEX_ENTRY = $codexEntry
Set-Location $backend
try { & $node (Join-Path $backend 'server.mjs'); if ($LASTEXITCODE -ne 0) { throw "Backend stopped with code $LASTEXITCODE" } }
finally { Remove-Item Env:\APP_PASSWORD -ErrorAction SilentlyContinue }
