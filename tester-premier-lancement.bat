@echo off
setlocal EnableExtensions
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  for /d %%D in ("%USERPROFILE%\Downloads\node-v*-win-x64") do (
    if exist "%%~fD\node.exe" set "PATH=%%~fD;%PATH%"
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable.
  pause
  exit /b 1
)

if not exist "node_modules\electron\package.json" (
  echo Installation des dependances locales...
  call npm install
  if errorlevel 1 (
    echo Echec de npm install.
    pause
    exit /b 1
  )
)

rem Base volontairement separee : aucune donnee de la base principale n'est modifiee.
set "AO_CREATOR_DATA_DIR=%~dp0data-test-first-run"
if exist "%AO_CREATOR_DATA_DIR%" rmdir /S /Q "%AO_CREATOR_DATA_DIR%"

echo Test d'un premier lancement vierge...
call npm run dev
endlocal
