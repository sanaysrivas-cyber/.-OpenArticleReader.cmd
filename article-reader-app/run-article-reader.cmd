@echo off
setlocal
cd /d "%~dp0"

set "LOCAL_NODE=%~dp0runtime\node.exe"
set "CODEX_NODE=%LOCALAPPDATA%\OpenAI\Codex\bin\node.exe"

if exist "%LOCAL_NODE%" (
  "%LOCAL_NODE%" server.mjs
) else if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" server.mjs
) else (
  echo Could not find Node in the app folder or at:
  echo %CODEX_NODE%
  echo.
  echo Install Node.js from https://nodejs.org/ or add node.exe to your PATH.
  pause
)
