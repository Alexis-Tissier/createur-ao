@echo off
setlocal

rem A placer sur le partage serveur a cote du dossier "Createur-AO-win-x64".
rem L'application est copiee localement uniquement lorsque les fichiers serveur sont plus recents.
set "SOURCE=%~dp0Createur-AO-win-x64"
set "TARGET=%LOCALAPPDATA%\CreateurAO\app"
set "EXE=%TARGET%\Createur-AO.exe"

if not exist "%SOURCE%\Createur-AO.exe" (
  echo [Createur AO] Application introuvable : "%SOURCE%\Createur-AO.exe"
  pause
  exit /b 1
)

if not exist "%TARGET%" mkdir "%TARGET%" >nul 2>&1

xcopy "%SOURCE%\*" "%TARGET%\" /D /E /I /Y /Q >nul
if errorlevel 1 (
  echo [Createur AO] Echec de la copie locale.
  pause
  exit /b 1
)

start "" "%EXE%"
exit /b 0
