/**
 * Generates InsightReply placeholder icons in Chrome-required sizes.
 * Pure Node: draws a navy rounded square with a white chat bubble,
 * gold border and gold dots (Hadesh.ai palette), written as raw PNG.
 * No image libraries required.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'assets', 'icons');
const SIZES = [16, 32, 48, 128];

const NAVY = [11, 18, 32];
const WHITE = [255, 255, 255];
const GOLD = [212, 175, 55];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function sdfRoundRect(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r);
  const dy = Math.abs(py - cy) - (hh - r);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const sign1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const sign2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const sign3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = sign1 < 0 || sign2 < 0 || sign3 < 0;
  const hasPos = sign1 > 0 || sign2 > 0 || sign3 > 0;
  return !(hasNeg && hasPos);
}

function sampleAt(s, x, y) {
  // Icon mask: rounded square
  if (sdfRoundRect(x, y, 0.5 * s, 0.5 * s, 0.5 * s, 0.5 * s, 0.22 * s) > 0) {
    return null;
  }
  const hw = 0.39 * s;
  const hh = 0.29 * s;
  const cx = 0.5 * s;
  const cy = 0.44 * s;
  const r = 0.19 * s;
  const border = Math.max(0.045 * s, 1.1);
  const dist = sdfRoundRect(x, y, cx, cy, hw, hh, r);
  const insideBubble = dist <= 0;
  const inBorder = insideBubble && dist > -border;
  const inTail =
    inTriangle(x, y, cx - hw + r * 0.5, cy + hh - r * 0.4, cx - hw * 0.55, cy + hh, cx - hw * 0.15, cy + hh + 0.24 * s);

  let color = NAVY;
  if (inTail || inBorder) {
    color = GOLD;
  } else if (insideBubble) {
    color = WHITE;
    const dotR = 0.05 * s;
    for (const dx of [-0.15 * s, 0, 0.15 * s]) {
      if (Math.hypot(x - (cx + dx), y - cy) <= dotR) {
        color = GOLD;
        break;
      }
    }
  }
  return color;
}

function renderIcon(size) {
  const ss = 4; // supersampling
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const color = sampleAt(size, px, py);
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += 1;
          }
        }
      }
      const total = ss * ss;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r / total);
      rgba[idx + 1] = Math.round(g / total);
      rgba[idx + 2] = Math.round(b / total);
      rgba[idx + 3] = Math.round((a / total) * 255);
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const path = join(OUT_DIR, `icon${size}.png`);
  writeFileSync(path, renderIcon(size));
  console.log(`wrote ${path}`);
}
