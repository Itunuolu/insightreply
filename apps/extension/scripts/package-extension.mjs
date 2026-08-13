/**
 * Packages dist-extension/ into dist/insightreply-extension.zip
 * (Chrome Web Store upload format). Uses PowerShell Compress-Archive on
 * Windows and the `zip` binary elsewhere; falls back to a pure-Node DEFLATE
 * zip writer if neither is available.
 */
import { execFileSync, execSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'dist-extension');
const OUT_DIR = join(ROOT, '..', '..', 'dist');
const OUT_ZIP = join(OUT_DIR, 'insightreply-extension.zip');
const CHROME_MANIFEST_DESCRIPTION_LIMIT = 132;

function validateManifest() {
  const manifestPath = join(SOURCE, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (
    typeof manifest.description !== 'string' ||
    manifest.description.length > CHROME_MANIFEST_DESCRIPTION_LIMIT
  ) {
    const actualLength = typeof manifest.description === 'string' ? manifest.description.length : 0;
    throw new Error(
      `manifest description is ${actualLength} characters; Chrome Web Store allows at most ${CHROME_MANIFEST_DESCRIPTION_LIMIT}`,
    );
  }
}

function collectFiles(dir) {
  const files = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(dir);
  return files;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeZip(files, dest) {
  const localOffset = Buffer.alloc(4);
  const central = [];
  const out = [];
  let offset = 0;
  for (const file of files) {
    const data = readFileSync(file);
    const name = Buffer.from(relative(SOURCE, file).split(sep).join('/'), 'utf8');
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8
    local.writeUInt16LE(8, 8); // method: deflate
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    out.push(local, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);

    offset += 30 + name.length + compressed.length;
  }

  const centralSize = central.reduce((sum, buf) => sum + buf.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(central.length / 2 / 2, 8);
  eocd.writeUInt16LE(central.length / 2 / 2, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  localOffset.writeUInt32LE(0, 0);

  const writeTo = createWriteStream(dest);
  for (const buf of out) writeTo.write(buf);
  for (const buf of central) writeTo.write(buf);
  writeTo.write(eocd);
  return new Promise((resolve, reject) => {
    writeTo.on('finish', resolve);
    writeTo.on('error', reject);
    writeTo.end();
  });
}

async function main() {
  if (!existsSync(SOURCE)) {
    throw new Error(`dist-extension missing — run \`pnpm build:extension\` first (${SOURCE})`);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  validateManifest();
  // `zip -r` UPDATES an existing archive rather than replacing it, so without
  // this every repackage kept the previous build's hashed bundles alongside the
  // new ones — dead weight in the upload, and a stale bundle can carry a
  // different baked-in backend URL than the one just built.
  rmSync(OUT_ZIP, { force: true });
  const files = collectFiles(SOURCE);

  let method = 'node';
  if (process.platform === 'win32') {
    try {
      execSync('powershell -NoProfile -Command "$null"', { stdio: 'ignore' });
      execFileSync('powershell', [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Force -Path '${SOURCE}\\*' -DestinationPath '${OUT_ZIP}'`,
      ]);
      method = 'powershell';
    } catch {
      method = 'node';
    }
  } else {
    try {
      execSync(`zip -qr "${OUT_ZIP}" .`, { cwd: SOURCE, stdio: 'ignore' });
      method = 'zip';
    } catch {
      method = 'node';
    }
  }

  if (method === 'node') {
    await writeZip(files, OUT_ZIP);
  }
  writeBuildInfo(files);
  console.log(`✓ packaged ${files.length} files -> ${OUT_ZIP} (${method})`);
}

/**
 * Writes BUILD-INFO.txt beside the zip.
 *
 * A packaged extension looks identical whether it points at a deployed backend
 * or at a developer's laptop, and uploading the latter breaks the extension for
 * every user who installs it. Recording the baked-in URL, the manifest details
 * and a checksum makes that visible without unzipping.
 */
function writeBuildInfo(files) {
  const manifest = JSON.parse(readFileSync(join(SOURCE, 'manifest.json'), 'utf8'));
  const metaPath = join(OUT_DIR, 'build-meta.json');
  const backendUrl = existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, 'utf8')).defaultBackendUrl
    : 'unknown (rebuild with `pnpm build:extension`)';
  const sha256 = createHash('sha256').update(readFileSync(OUT_ZIP)).digest('hex');
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(backendUrl);

  const lines = [
    'InsightReply — Chrome Web Store package',
    '',
    `name              ${manifest.name}`,
    `version           ${manifest.version}`,
    `manifest_version  ${manifest.manifest_version}`,
    `permissions       ${manifest.permissions.join(', ')}`,
    `host_permissions  ${manifest.host_permissions.join(', ')}`,
    '',
    `default backend   ${backendUrl}`,
    `files             ${files.length}`,
    `sha256            ${sha256}`,
    '',
    isLocal
      ? [
          'DO NOT UPLOAD THIS BUILD.',
          '',
          'It points at a backend on the build machine, so anyone installing it from',
          'the Web Store — including the reviewer — gets "could not be reached" the',
          'first time they press Generate. Rebuild against your deployed backend:',
          '',
          '  IR_DEFAULT_BACKEND_URL=https://your-backend.example.com \\',
          '    pnpm build:extension && pnpm package:extension',
        ].join('\n')
      : 'Ready to upload. Confirm the backend above is reachable over HTTPS first.',
    '',
  ];
  writeFileSync(join(OUT_DIR, 'BUILD-INFO.txt'), `${lines.join('\n')}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
