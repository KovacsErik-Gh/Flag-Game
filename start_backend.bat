@echo off
echo.
echo  ==========================================
echo   Guess the Flag - Backend (Python FastAPI)
echo  ==========================================
echo.
echo  Starting backend on http://localhost:8000
echo.
cd /d "%~dp0backend"
python main.py
pause
