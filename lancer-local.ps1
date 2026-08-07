$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $portable = Get-ChildItem "$env:USERPROFILE\Downloads" -Directory -Filter 'node-v*-win-x64' -ErrorAction SilentlyContinue |
        Where-Object { Test-Path (Join-Path $_.FullName 'node.exe') } |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if ($portable) { $env:PATH = "$($portable.FullName);$env:PATH" }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js est introuvable. Placez une version portable node-vXX-win-x64 dans Téléchargements.'
}
if (-not (Test-Path 'node_modules')) { npm install }
npm run dev
