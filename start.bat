@echo off
rem Double-click to play: starts the local server in its own window and opens the game.
rem Opens in Microsoft Edge when available - its "Natural" voices make Seraphine sound far better.
cd /d "%~dp0"
start "Oracle server (close this window to stop)" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1" -Port 5173
timeout /t 2 /nobreak >nul
where msedge >nul 2>nul && (start "" msedge http://localhost:5173/) || (
  if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" http://localhost:5173/
  ) else (
    start "" http://localhost:5173/
  )
)
