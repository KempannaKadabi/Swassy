@echo off
echo ================================================================
echo   Starting Swasya AI Clinical Operating System
echo ================================================================
echo.

where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using Python Launcher (py)...
    py -m pip install -r requirements.txt
    py start.py
    goto end
)

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Using Python (python)...
    python -m pip install -r requirements.txt
    python start.py
    goto end
)

echo.
echo [ERROR] Python was not found on your system PATH!
echo Please install Python 3.10 or 3.11 from https://www.python.org/downloads/
echo Make sure to check the box: "Add python.exe to PATH" during installation.
echo.
pause

:end
