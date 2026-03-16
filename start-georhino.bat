@echo off
title GeoRhino - Starting...
echo.
echo  ========================================
echo    GeoRhino - GIS to Rhino Site File Gen
echo  ========================================
echo.
echo  Starting dev server on http://localhost:3000
echo  (This window must stay open while using the app)
echo.

cd /d "C:\Users\mxrca\OneDrive\Desktop\MAPPING-APP"

:: Open browser after a short delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

:: Start the dev server
"C:\Users\mxrca\node-v22.14.0-win-x64\node.exe" node_modules\next\dist\bin\next dev
