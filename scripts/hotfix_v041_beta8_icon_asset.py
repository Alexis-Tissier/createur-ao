from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

app_path = ROOT / 'src' / 'AppV4.jsx'
app = app_path.read_text(encoding='utf-8')
old_import = "import appIconBase64 from './assets/app-icon.b64?raw';\n\nconst APP_ICON_DATA_URL = `data:image/png;base64,${appIconBase64.replace(/\\s+/g,'')}`;\n\n"
if old_import in app:
    app = app.replace(old_import, '', 1)
elif "appIconBase64" in app or "APP_ICON_DATA_URL" in app:
    raise SystemExit('Bloc base64 du logo inattendu dans AppV4.jsx')

old_img = '<img src={APP_ICON_DATA_URL} alt=""/>'
new_img = '<img src="/app-icon.png" alt=""/>'
if old_img not in app and new_img not in app:
    raise SystemExit('Image du logo introuvable dans AppV4.jsx')
app = app.replace(old_img, new_img, 1)
app_path.write_text(app, encoding='utf-8')

prepare_path = ROOT / 'scripts' / 'prepare-icon.mjs'
prepare_path.write_text("""import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildDir = path.join(root, 'build');
const publicDir = path.join(root, 'public');
const sourcePath = path.join(root, 'src', 'assets', 'app-icon.b64');
const pngPath = path.join(buildDir, 'icon.png');
const publicPngPath = path.join(publicDir, 'app-icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

function makeIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 0;
  entry[1] = 0;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);
  return Buffer.concat([header, entry, png]);
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(publicDir, { recursive: true });
const encoded = (await fs.readFile(sourcePath, 'utf8')).replace(/\\s+/g, '');
const png = Buffer.from(encoded, 'base64');

if (png.length < 8 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
  throw new Error('La source du logo n’est pas un PNG valide.');
}

await fs.writeFile(pngPath, png);
await fs.writeFile(publicPngPath, png);
await fs.writeFile(icoPath, makeIco(png));
console.log(`Logo web généré : ${publicPngPath}`);
console.log(`Logo Windows généré : ${icoPath}`);
""", encoding='utf-8')

pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.8'
pkg['scripts']['build'] = 'npm run prepare:icon && vite build'
pkg['scripts']['dist:win'] = 'npm run build && electron-builder --win nsis portable --x64 --publish never'
pkg['scripts']['dist:win:dir'] = 'npm run build && electron-builder --win --dir --x64 --publish never'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('beta8: logo converted to a real public PNG asset')
