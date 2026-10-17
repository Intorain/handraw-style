@echo off
chcp 65001 >nul
title HandRaw Style Studio
echo ======================================================================
echo           🎨 HandRaw Style Studio - 独立手绘创作客户端
echo ======================================================================
echo 正在启动客户端本地服务端...
echo.

where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未在系统 PATH 中检测到 Python 环境。
    echo 请先安装 Python 3.8 或更高版本 (https://www.python.org/downloads/)。
    echo.
    pause
    exit /b 1
)

cd /d "%~dp0"
python server.py

pause
