import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, 'build', 'icon.ico.b64');
const target = path.join(root, 'build', 'icon.ico');
const payload = (await fs.readFile(source, 'utf8')).trim();
await fs.writeFile(target, Buffer.from(payload, 'base64'));
console.log(`Icône Windows prête : ${target}`);
