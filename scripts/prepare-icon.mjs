import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildDir = path.join(root, 'build');
const sourcePath = path.join(root, 'src', 'assets', 'app-icon.b64');
const pngPath = path.join(buildDir, 'icon.png');
const icoPath = path.join(buildDir, 'icon.ico');

function makeIco(png) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = 0; // 256 px
  entry[1] = 0; // 256 px
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, png]);
}

await fs.mkdir(buildDir, { recursive: true });
const encoded = (await fs.readFile(sourcePath, 'utf8')).trim();
const png = Buffer.from(encoded, 'base64');

if (png.length < 8 || !png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
  throw new Error('La source du logo n’est pas un PNG valide.');
}

await fs.writeFile(pngPath, png);
await fs.writeFile(icoPath, makeIco(png));
console.log(`Logo Créateur d’AO généré depuis le nouveau visuel : ${icoPath}`);
