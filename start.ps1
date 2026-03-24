# 一键启动：后端 + 前端（各一个新窗口）
# 用法：在资源管理器中右键「使用 PowerShell 运行」，或:  powershell -ExecutionPolicy Bypass -File .\start.ps1

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host "[AI Quant] 启动后端与前端..." -ForegroundColor Cyan

$backendCmd = $null
$venvActivate = Join-Path $Backend ".venv\Scripts\activate.bat"
if (Test-Path $venvActivate) {
  $backendCmd = "cd /d `"$Backend`" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
  $backendCmd = "cd /d `"$Backend`" && py -3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
  $backendCmd = "cd /d `"$Backend`" && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
} else {
  $backendCmd = "cd /d `"$Backend`" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
}

Start-Process cmd -ArgumentList "/k", $backendCmd -WindowStyle Normal
Start-Sleep -Seconds 1

$frontendCmd = "cd /d `"$Frontend`" && if not exist node_modules npm install && npm run dev"
Start-Process cmd -ArgumentList "/k", $frontendCmd -WindowStyle Normal

Write-Host "后端: http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "前端: http://127.0.0.1:5173" -ForegroundColor Green
