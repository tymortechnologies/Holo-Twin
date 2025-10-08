# PowerShell script to start ngrok for mobile testing
Write-Host "Starting ngrok tunnel for AR Holo-Twin mobile testing..." -ForegroundColor Green
Write-Host ""
Write-Host "Make sure your Next.js dev server is running on port 3000" -ForegroundColor Yellow
Write-Host "If not, run: npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "Starting ngrok tunnel..." -ForegroundColor Cyan

# Start ngrok
ngrok http 3000 --host-header=localhost:3000
