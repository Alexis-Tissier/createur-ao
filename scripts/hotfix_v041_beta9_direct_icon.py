from pathlib import Path
import base64, json, re

root = Path(__file__).resolve().parents[1]
assets = root / 'src' / 'assets'
b64 = re.sub(r'\s+', '', (assets / 'app-icon.b64').read_text(encoding='utf-8'))
png = base64.b64decode(b64)
if not png.startswith(b'\x89PNG\r\n\x1a\n'):
    raise SystemExit('Logo PNG invalide')
(assets / 'app-icon.png').write_bytes(png)

app_path = root / 'src' / 'AppV4.jsx'
app = app_path.read_text(encoding='utf-8')
imp = "import appIcon from './assets/app-icon.png';\n"
if imp not in app:
    app = app.replace("import React, { useEffect, useMemo, useState } from 'react';\n", "import React, { useEffect, useMemo, useState } from 'react';\n" + imp, 1)
app = app.replace('<img src="/app-icon.png" alt=""/>', '<img src={appIcon} alt=""/>')
app = app.replace('<img src={APP_ICON_DATA_URL} alt=""/>', '<img src={appIcon} alt=""/>')
app = re.sub(r"import appIconBase64[^\n]*\n", '', app)
app = re.sub(r"const APP_ICON_DATA_URL[^\n]*\n", '', app)
if '<img src={appIcon} alt=""/>' not in app:
    raise SystemExit('Balise logo introuvable')
app_path.write_text(app, encoding='utf-8')

(root / 'scripts' / 'prepare-icon.mjs').write_text("""import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildDir = path.join(root, 'build');
const sourcePath = path.join(root, 'src', 'assets', 'app-icon.png');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');
function makeIco(png) {
  const header = Buffer.alloc(6); header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
  const entry = Buffer.alloc(16); entry[0]=0; entry[1]=0; entry.writeUInt16LE(1,4); entry.writeUInt16LE(32,6); entry.writeUInt32LE(png.length,8); entry.writeUInt32LE(22,12);
  return Buffer.concat([header, entry, png]);
}
await fs.mkdir(buildDir,{recursive:true});
const png = await fs.readFile(sourcePath);
if (!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('PNG invalide');
await fs.writeFile(pngPath,png); await fs.writeFile(icoPath,makeIco(png));
""", encoding='utf-8')

pkg_path = root / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.9'
pkg['scripts']['build'] = 'vite build'
pkg['scripts']['dist:win'] = 'npm run prepare:icon && npm run build && electron-builder --win nsis portable --x64 --publish never'
pkg['scripts']['dist:win:dir'] = 'npm run prepare:icon && npm run build && electron-builder --win --dir --x64 --publish never'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('beta9 direct PNG ready')
