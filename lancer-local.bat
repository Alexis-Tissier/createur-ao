@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Pendant les versions de test, conserve automatiquement la base remplie de la v0.2.2.
if not exist "data\createur-ao.db" (
  if exist "..\createur-ao-v0.2.2\data\createur-ao.db" (
    echo Recuperation de la configuration et de l'historique v0.2.2...
    if not exist "data" mkdir "data"
    copy /Y "..\createur-ao-v0.2.2\data\createur-ao.db" "data\createur-ao.db" >nul
  ) else if exist "..\createur-ao-v0.2.1\data\createur-ao.db" (
    echo Recuperation de la configuration v0.2.1...
    if not exist "data" mkdir "data"
    copy /Y "..\createur-ao-v0.2.1\data\createur-ao.db" "data\createur-ao.db" >nul
  )
)

where node >nul 2>nul
if errorlevel 1 (
  for /d %%D in ("%USERPROFILE%\Downloads\node-v*-win-x64") do (
    if exist "%%~fD\node.exe" set "PATH=%%~fD;%PATH%"
  )
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js est introuvable.
  echo Place le dossier node-vXX-win-x64 dans %USERPROFILE%\Downloads puis relance ce fichier.
  pause
  exit /b 1
)

for /f "tokens=*" %%V in ('node -v') do echo Node %%V detecte.

set "NEED_INSTALL=0"
if not exist "node_modules" set "NEED_INSTALL=1"
if not exist "node_modules\electron\package.json" set "NEED_INSTALL=1"

if "%NEED_INSTALL%"=="1" (
  echo Installation des dependances locales...
  call npm install
  if errorlevel 1 (
    echo Echec de npm install.
    pause
    exit /b 1
  )
)

echo Demarrage de Createur d'AO...
echo L'application va s'ouvrir dans sa propre fenetre.
call npm run dev
endlocal
