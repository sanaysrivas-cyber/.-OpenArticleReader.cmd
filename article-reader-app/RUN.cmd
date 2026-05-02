@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%~dp0runtime\node.exe"

if not exist "%NODE_EXE%" (
  echo Could not find runtime\node.exe
  pause
  exit /b 1
)

start "" "http://localhost:4173"
"%NODE_EXE%" server.mjs
pause
