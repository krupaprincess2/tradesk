@echo off
echo Starting TradDesk...
echo.
docker-compose up --build -d
echo.
echo TradDesk is running!
echo.
echo   Open your app:   http://localhost:3000
echo   API health:      http://localhost:4000/health
echo.
echo   To stop: docker-compose down
pause
