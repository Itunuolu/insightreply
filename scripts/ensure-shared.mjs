/**
 * Builds the shared package before a script that depends on it.
 * Used by extension scripts so they work from a clean checkout.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
execSync('pnpm --filter @insightreply/shared build', { cwd: ROOT, stdio: 'inherit' });
console.log('✓ shared package built');
