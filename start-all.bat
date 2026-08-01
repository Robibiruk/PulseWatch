@echo off
echo Starting PulseWatch...
echo.
echo [1/2] Serving docs-site on http://localhost:3000
start "PulseWatch Docs" cmd /k "cd /d docs-site && npm run start"
timeout /t 3 /nobreak >nul
echo [2/2] Starting frontend on http://localhost:5173
start "PulseWatch Frontend" cmd /k "cd /d frontend && npm run dev"
echo.
echo Both services are starting in separate windows.