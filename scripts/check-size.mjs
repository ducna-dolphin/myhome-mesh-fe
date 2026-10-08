#!/usr/bin/env node
// Bundle budget for the shipped build (VITE_API_MODE=remote, i.e. without MSW).
// Builds into dist-size/, then fails when the entry JS > 180 kB gzip or any other JS chunk
// (lazy route pages and their shared chunks) > 60 kB gzip, or when MSW leaked into the bundle.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const ENTRY_BUDGET_KB = 180;
const CHUNK_BUDGET_KB = 60;

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'dist-size');

rmSync(outDir, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', outDir, '--logLevel', 'warn'],
  { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_API_MODE: 'remote' } },
);

const html = readFileSync(join(outDir, 'index.html'), 'utf8');
const entryMatch = html.match(/<script[^>]+src="[^"]*\/assets\/([^"]+\.js)"/);
if (!entryMatch) {
  console.error('size — entry script not found in index.html');
  process.exit(1);
}
const entryFile = entryMatch[1];

const assetsDir = join(outDir, 'assets');
const rows = readdirSync(assetsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const source = readFileSync(join(assetsDir, file));
    const isEntry = file === entryFile;
    return {
      file,
      isEntry,
      gzipKb: gzipSync(source, { level: 9 }).length / 1024,
      budgetKb: isEntry ? ENTRY_BUDGET_KB : CHUNK_BUDGET_KB,
      hasMsw: /mockServiceWorker|setupWorker|\[MSW\]/.test(source.toString('utf8')),
    };
  })
  .sort((a, b) => b.gzipKb - a.gzipKb);

let failed = false;
for (const row of rows) {
  const over = row.gzipKb > row.budgetKb;
  if (over || row.hasMsw) failed = true;
  const flag = over ? '  OVER BUDGET' : row.hasMsw ? '  CONTAINS MSW' : '';
  const label = row.isEntry ? `${row.file} (entry)` : row.file;
  console.log(`${row.gzipKb.toFixed(2).padStart(8)} kB / ${row.budgetKb} kB  ${label}${flag}`);
}

const total = rows.reduce((sum, row) => sum + row.gzipKb, 0);
console.log(`${total.toFixed(2).padStart(8)} kB total JS (gzip)`);
rmSync(outDir, { recursive: true, force: true });

if (failed) {
  console.error('size — bundle budget exceeded or MSW found in the remote build.');
  process.exit(1);
}
console.log('size — within budget (entry ≤ 180 kB, chunks ≤ 60 kB gzip, no MSW).');
