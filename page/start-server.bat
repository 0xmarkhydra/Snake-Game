@echo off
echo Starting server for page directory...
echo.
echo Server will be available at http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
npx --yes serve -l 3000
pause

