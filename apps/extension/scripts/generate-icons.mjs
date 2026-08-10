/**
 * Generates the InsightReply extension icons in Chrome-required sizes.
 *
 * The artwork mirrors docs/brand/insightreply-mark.svg: a navy tile with a gold
 * rim, a gold reply bubble, and the "insight" spark knocked out of the bubble.
 * Geometry below is expressed in the SVG's 64-unit coordinate space so the two
 * files can be kept in sync by eye.
 *
 * Pure Node — no image libraries, no headless browser — because this runs as
 * part of `pnpm build:extension` on clean checkouts and in CI.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'src', 'assets', 'icons');
const SIZES = [16, 32, 48, 128];

/** Design space matches the SVG viewBox. */
const VB = 64;

const NAVY = [11, 18, 32];
const RIM = [212, 175, 55];
const RIM_OPACITY = 0.45;

/** Gold gradient stops, matching the SVG's linearGradient. */
const GRADIENT = {
  from: [14, 12],
  to: [50, 52],
  stops: [
    [0, [242, 220, 138]],
    [0.5, [232, 201, 94]],
    [1, [201, 155, 46]],
  ],
};

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

/** Signed distance to a rounded rectangle centred at (cx, cy). */
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

/**
 * Four-pointed spark: an astroid, whose concave sides give the shape its
 * "sparkle" read rather than the blunt look of a straight-sided star.
 */
function inSpark(px, py, cx, cy, radius) {
  const u = Math.abs(px - cx) / radius;
  const v = Math.abs(py - cy) / radius;
  if (u > 1 || v > 1) return false;
  return Math.sqrt(u) + Math.sqrt(v) <= 1;
}

function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Samples the gold gradient at a point, projected onto the gradient axis. */
function goldAt(px, py) {
  const [ax, ay] = GRADIENT.from;
  const [bx, by] = GRADIENT.to;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const stops = GRADIENT.stops;
  for (let i = 1; i < stops.length; i += 1) {
    const [t0, c0] = stops[i - 1];
    const [t1, c1] = stops[i];
    if (t <= t1) return mix(c0, c1, (t - t0) / (t1 - t0));
  }
  return stops[stops.length - 1][1];
}

/** Returns the colour at a point in 64-unit design space, or null outside the tile. */
function sampleAt(x, y) {
  // Tile
  if (sdfRoundRect(x, y, 32, 32, 32, 32, 14) > 0) return null;

  // Reply bubble body + tail
  const inBubble = sdfRoundRect(x, y, 32, 27, 21, 14, 11) <= 0;
  const inTail = inTriangle(x, y, 28.5, 41, 20.1, 49.6, 18.4, 40.4);
  if (inBubble || inTail) {
    // The spark is knocked out of the bubble.
    return inSpark(x, y, 32, 27, 9.95) ? NAVY : goldAt(x, y);
  }

  // Gold rim: a 2.5-unit stroke inset from the tile edge.
  const rim = sdfRoundRect(x, y, 32, 32, 30.75, 30.75, 12.75);
  if (rim > -1.25 && rim < 1.25) return mix(NAVY, RIM, RIM_OPACITY);

  return NAVY;
}

function renderIcon(size) {
  const ss = 4; // supersampling
  const scale = VB / size;
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const color = sampleAt((x + (sx + 0.5) / ss) * scale, (y + (sy + 0.5) / ss) * scale);
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
      // Un-premultiply so edge pixels keep the fill colour rather than fading to black.
      rgba[idx] = a ? Math.round(r / a) : 0;
      rgba[idx + 1] = a ? Math.round(g / a) : 0;
      rgba[idx + 2] = a ? Math.round(b / a) : 0;
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
