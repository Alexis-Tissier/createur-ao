import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildDir = path.join(root, 'build');
const publicDir = path.join(root, 'public');
const sourcePath = path.join(root, 'src', 'assets', 'app-icon.b64');
const pngPath = path.join(buildDir, 'icon.png');
const publicPngPath = path.join(publicDir, 'app-icon.png');
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(publicDir, { recursive: true });

const encoded = (await fs.readFile(sourcePath, 'utf8')).replace(/\s+/g, '');
const png = Buffer.from(encoded, 'base64');
if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
  throw new Error('La source du logo n’est pas un PNG valide.');
}

const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width !== 256 || height !== 256) {
  throw new Error(`Le logo Windows doit faire 256x256 px, reçu ${width}x${height}.`);
}

await fs.writeFile(pngPath, png);
await fs.writeFile(publicPngPath, png);
console.log(`Logo PNG canonique généré : ${pngPath} (${width}x${height})`);
console.log('electron-builder convertira lui-même ce PNG en ressource Windows native.');
