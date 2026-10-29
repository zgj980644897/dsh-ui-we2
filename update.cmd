@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" %*
set CODE=%ERRORLEVEL%
if not "%CODE%"=="0" pause
endlocal
exit /b %CODE%
