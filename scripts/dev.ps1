# Starts the API, one market worker, and the frontend. See scripts/dev.py.
Set-Location (Join-Path $PSScriptRoot "..")
$python = Join-Path $PSScriptRoot "..\backend\venv\Scripts\python.exe"
& $python (Join-Path $PSScriptRoot "dev.py") @args
