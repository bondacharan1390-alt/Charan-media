@echo off
title Charan Media - Video to MP3 Converter
cd /d "%~dp0"

echo ========================================================
echo         CHARAN MEDIA - VIDEO TO MP3 CONVERTER
echo ========================================================
echo.

set "PY_EXE="

if exist "%~dp0.venv\Scripts\python.exe" (
    set "PY_EXE=%~dp0.venv\Scripts\python.exe"
) else if exist "%USERPROFILE%\.local\bin\python.exe" (
    set "PY_EXE=%USERPROFILE%\.local\bin\python.exe"
) else (
    where python >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PY_EXE=python"
    )
)

if "%PY_EXE%"=="" (
    echo [ERROR] Python was not found.
    echo Please make sure Python or the virtual environment is installed.
    pause
    exit /b 1
)

echo Starting Charan Media Server with: %PY_EXE%
echo Opening http://127.0.0.1:8000 in your browser...
echo.

start "" "http://127.0.0.1:8000"
"%PY_EXE%" server.py

pause
