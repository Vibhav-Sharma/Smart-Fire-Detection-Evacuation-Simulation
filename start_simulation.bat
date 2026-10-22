@echo off
title Smart Fire Detection & Evacuation Simulation
echo Starting local web server on port 3000...
cd /d "%~dp0"
start http://localhost:3000
python -m http.server 3000
pause
