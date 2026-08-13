import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const buildDir = path.join(root, 'build');
const publicDir = path.join(root, 'public');
const pngPath = path.join(buildDir, 'icon.png');
const publicPngPath = path.join(publicDir, 'app-icon.png');
const size = 256;
const supersample = 4;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function roundedSquare(x, y, inset = 13, radius = 48) {
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;
  if (x < left || x > right || y < top || y > bottom) return false;
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return ((x - cx) ** 2 + (y - cy) ** 2) <= radius ** 2;
}

function cShape(x, y) {
  const dx = x - 128;
  const dy = y - 128;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const ring = distance >= 49 && distance <= 84;
  const opening = dx > 14 && Math.abs(dy) < 49;
  const serifTop = dx >= 12 && dx <= 42 && dy >= -72 && dy <= -55;
  const serifBottom = dx >= 12 && dx <= 42 && dy >= 55 && dy <= 72;
  return (ring && !opening) || serifTop || serifBottom;
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function samplePixel(x, y) {
  if (!roundedSquare(x, y)) return [0, 0, 0, 0];

  const t = Math.max(0, Math.min(1, (x + y) / (2 * size)));
  let r = mix(242, 223, t);
  let g = mix(122, 88, t);
  let b = mix(84, 56, t);

  const edge = roundedSquare(x, y, 15, 46) ? 0 : 1;
  if (edge) {
    r = mix(r, 150, 0.22);
    g = mix(g, 63, 0.22);
    b = mix(b, 39, 0.22);
  }

  if (y < 70) {
    const highlight = Math.max(0, (70 - y) / 300);
    r = mix(r, 255, highlight);
    g = mix(g, 255, highlight);
    b = mix(b, 255, highlight);
  }

  if (cShape(x, y)) return [255, 247, 238, 255];
  return [r, g, b, 255];
}

function makePng() {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    rows[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      let rr = 0;
      let gg = 0;
      let bb = 0;
      let aa = 0;
      for (let sy = 0; sy < supersample; sy += 1) {
        for (let sx = 0; sx < supersample; sx += 1) {
          const px = x + (sx + 0.5) / supersample;
          const py = y + (sy + 0.5) / supersample;
          const [r, g, b, a] = samplePixel(px, py);
          rr += r * a;
          gg += g * a;
          bb += b * a;
          aa += a;
        }
      }
      const samples = supersample * supersample;
      const alpha = Math.round(aa / samples);
      const offset = rowStart + 1 + x * 4;
      rows[offset + 3] = alpha;
      if (aa > 0) {
        rows[offset] = Math.round(rr / aa);
        rows[offset + 1] = Math.round(gg / aa);
        rows[offset + 2] = Math.round(bb / aa);
      }
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const compressed = zlib.deflateSync(rows, { level: 9 });
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(publicDir, { recursive: true });
const png = makePng();
await fs.writeFile(pngPath, png);
await fs.writeFile(publicPngPath, png);
console.log(`Logo Créateur d’AO valide généré : ${pngPath} (${size}x${size}, RGBA)`);
