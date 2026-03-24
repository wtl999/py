@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"

echo [AI Quant] 正在启动后端与前端（各开一个窗口）...
echo.

REM ---------- 后端 ----------
if exist "%ROOT%backend\.venv\Scripts\activate.bat" (
  start "AI Quant 后端" cmd /k "cd /d "%ROOT%backend" && call .venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
) else (
  where py >nul 2>&1 && (
    start "AI Quant 后端" cmd /k "cd /d "%ROOT%backend" && py -3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
  ) || (
    where python3 >nul 2>&1 && (
      start "AI Quant 后端" cmd /k "cd /d "%ROOT%backend" && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    ) || (
      start "AI Quant 后端" cmd /k "cd /d "%ROOT%backend" && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    )
  )
)

timeout /t 1 /nobreak >nul

REM ---------- 前端 ----------
start "AI Quant 前端" cmd /k "cd /d "%ROOT%frontend" && if not exist node_modules npm install && npm run dev"

echo.
echo 后端: http://127.0.0.1:8000/docs
echo 前端: http://127.0.0.1:5173
echo.
echo 若后端窗口报错，请先在 backend 下执行: python -m venv .venv ^&^& .venv\Scripts\activate ^&^& pip install -r requirements.txt
echo.
pause
endlocal
