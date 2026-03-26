@echo off
chcp 65001 >nul
setlocal EnableExtensions

title AI Quant 启动器 - 启动中...

set "ROOT=%~dp0"
set "BACKEND_DIR=%ROOT%backend"
set "FRONTEND_DIR=%ROOT%frontend"
set "BACKEND_VENV=%BACKEND_DIR%\.venv"
set "BACKEND_PY=%BACKEND_VENV%\Scripts\python.exe"

echo ================================================
echo           AI Quant 量化系统 - 启动器
echo ================================================
echo.
echo 正在启动后端和前端...
echo.

:: 检查目录和环境
if not exist "%BACKEND_DIR%" (
  echo [错误] 未找到 backend 目录！
  pause
  exit /b 1
)
if not exist "%FRONTEND_DIR%" (
  echo [错误] 未找到 frontend 目录！
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 npm，请安装 Node.js
  pause
  exit /b 1
)

:: 准备后端环境
echo [1/2] 准备后端...
if not exist "%BACKEND_PY%" (
  echo    正在创建虚拟环境...
  where py >nul 2>&1
  if not errorlevel 1 (
    py -3 -m venv "%BACKEND_VENV%"
  ) else (
    python -m venv "%BACKEND_VENV%"
  )
)

if exist "%BACKEND_PY%" (
  "%BACKEND_PY%" -m pip install -q -r "%BACKEND_DIR%\requirements.txt" 2>nul
)

echo [2/2] 启动服务窗口...

:: 启动后端窗口
start "AI Quant - 后端" cmd /k "cd /d "%BACKEND_DIR%" && title AI Quant - 后端服务 && echo ================================================ && echo               AI Quant 后端服务 && echo ================================================ && echo 正在启动后端服务器... && "%BACKEND_PY%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak >nul

:: 启动前端窗口
start "AI Quant - 前端" cmd /k "cd /d "%FRONTEND_DIR%" && title AI Quant - 前端界面 && echo ================================================ && echo               AI Quant 前端界面 && echo ================================================ && echo 正在启动前端... && if not exist node_modules (echo 首次运行，正在安装依赖... && npm install) && npm run dev"

echo.
echo 两个服务窗口已成功启动！
echo.
echo 启动器窗口即将自动关闭...
echo.
echo 后端地址: http://127.0.0.1:8000/docs
echo 前端地址: http://localhost:5174
echo.

:: 等待3秒后自动关闭启动器窗口
timeout /t 4 /nobreak >nul

endlocal
exit