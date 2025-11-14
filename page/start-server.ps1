# Start static server for page directory
Write-Host "Starting server for page directory..." -ForegroundColor Green
Write-Host "Server will be available at http://localhost:3000" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Cyan
Write-Host ""

npx --yes serve -l 3000

