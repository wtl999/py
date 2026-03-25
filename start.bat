@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND_DIR=%ROOT%\backend"
set "FRONTEND_DIR=%ROOT%\frontend"
set "BACKEND_VENV=%BACKEND_DIR%\.venv"
set "BACKEND_PY=%BACKEND_VENV%\Scripts\python.exe"

echo [AI Quant] 一键启动：后端 + 前端
echo.

if not exist "%BACKEND_DIR%" (
  echo [ERROR] 未找到后端目录: "%BACKEND_DIR%"
  exit /b 1
)
if not exist "%FRONTEND_DIR%" (
  echo [ERROR] 未找到前端目录: "%FRONTEND_DIR%"
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] 未找到 npm，请先安装 Node.js（含 npm）
  exit /b 1
)
set "NPM_CMD="
for /f "delims=" %%I in ('where npm') do (
  set "NPM_CMD=%%I"
  goto :npm_found
)
:npm_found
if "%NPM_CMD%"=="" (
  echo [ERROR] 未找到 npm 执行文件路径
  exit /b 1
)

set "BACKEND_OK=1"
if not exist "%BACKEND_PY%" (
  echo [PREP] 未检测到后端虚拟环境，正在创建 .venv ...
  set "PY_FOR_VENV="
  where py >nul 2>&1
  if not errorlevel 1 (
    set "PY_FOR_VENV=py -3"
  ) else (
    where python3 >nul 2>&1
    if not errorlevel 1 (
      set "PY_FOR_VENV=python3"
    )
  )
  if "%PY_FOR_VENV%"=="" (
    echo [ERROR] 未找到 Python3（py/python3）。当前机器可能只有 Python2.7，FastAPI/uvicorn 无法运行。
    echo [HINT] 请安装 Python3 并确保命令可用：`py -3` 或 `python3`。
    set "BACKEND_OK=0"
  ) else (
    %PY_FOR_VENV% -m venv "%BACKEND_VENV%"
    if errorlevel 1 (
      echo [ERROR] 后端虚拟环境创建失败（请检查 Python3 是否可用）：%PY_FOR_VENV%
      set "BACKEND_OK=0"
    )
  )
)

if "%BACKEND_OK%"=="1" (
  if not exist "%BACKEND_PY%" (
    echo [ERROR] 后端虚拟环境创建失败: "%BACKEND_PY%"
    set "BACKEND_OK=0"
  )
)

if "%BACKEND_OK%"=="1" (
  if not exist "%BACKEND_DIR%\requirements.txt" (
    echo [ERROR] 未找到后端依赖文件: "%BACKEND_DIR%\requirements.txt"
    set "BACKEND_OK=0"
  )
)

if "%BACKEND_OK%"=="1" (
  echo [PREP] 检查后端依赖...
  "%BACKEND_PY%" -c "import uvicorn,fastapi" >nul 2>&1
  if errorlevel 1 (
    echo [PREP] 正在安装后端依赖（首次可能较慢）...
    "%BACKEND_PY%" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    if errorlevel 1 (
      echo [ERROR] 后端依赖安装失败，请检查网络或 pip 源配置
      set "BACKEND_OK=0"
    )
  )
)

if "%BACKEND_OK%"=="1" (
  echo [1/2] 启动后端窗口...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "Start-Process -FilePath '%BACKEND_PY%' -WorkingDirectory '%BACKEND_DIR%' -ArgumentList '-m','uvicorn','app.main:app','--host','0.0.0.0','--port','8000'"
  timeout /t 1 /nobreak >nul
) else (
  echo [WARN] 后端未启动（原因如上）。前端仍将启动。
)

echo [2/2] 启动前端窗口...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath 'cmd.exe' -WorkingDirectory '%FRONTEND_DIR%' -ArgumentList '/k','if not exist node_modules (\"%NPM_CMD%\" install) && \"%NPM_CMD%\" run dev'"

echo.
if "%BACKEND_OK%"=="1" (
  echo [CHECK] 等待后端健康检查: http://127.0.0.1:8000/health
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false;1..40|%%{try{$r=Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/health' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){$ok=$true;break}}catch{};Start-Sleep -Milliseconds 500}; if($ok){exit 0}else{exit 1}"
  if errorlevel 1 (
    echo [WARN] 后端健康检查失败，请查看“AI Quant 后端”窗口日志
  ) else (
    echo [OK] 后端已就绪
  )
) else (
  echo [WARN] 跳过后端健康检查（后端未启动）
)

echo [CHECK] 等待前端页面: http://localhost:5174
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false;1..40|%%{try{$r=Invoke-WebRequest -UseBasicParsing 'http://localhost:5174/' -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){$ok=$true;break}}catch{};Start-Sleep -Milliseconds 500}; if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo [WARN] 前端访问检查失败，请查看“AI Quant 前端”窗口日志
) else (
  echo [OK] 前端已就绪
  start "" "http://localhost:5174/"
)

echo.
if "%BACKEND_OK%"=="1" (
  echo 后端文档: http://127.0.0.1:8000/docs
) else (
  echo 后端文档: (后端未启动)
)
echo 前端地址: http://localhost:5174
echo.
endlocal
