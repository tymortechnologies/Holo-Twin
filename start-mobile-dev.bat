@echo off
echo Starting AR Holo-Twin for Mobile Testing...
echo.
echo This will start:
echo 1. Next.js development server on http://localhost:3000
echo 2. ngrok tunnel for mobile access
echo.
echo Once started, you'll get an ngrok URL like: https://abc123.ngrok.io
echo Use this URL on your mobile device to test the AR app
echo.
pause
npm run dev:mobile
