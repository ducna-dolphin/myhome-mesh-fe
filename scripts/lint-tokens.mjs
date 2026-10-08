#!/usr/bin/env node
// Fails when a stylesheet under src/ hardcodes a hex colour instead of using a design token.
// Only src/app/styles/tokens.css may define raw colour values.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = join(root, 'src');
const allowed = new Set([join('src', 'app', 'styles', 'tokens.css')]);
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

function* cssFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* cssFiles(path);
    else if (entry.name.endsWith('.css')) yield path;
  }
}

/** Blanks out comments but keeps newlines so reported line numbers stay accurate. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

const violations = [];
for (const file of cssFiles(srcDir)) {
  const rel = relative(root, file);
  if (allowed.has(rel)) continue;
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(HEX)) {
      violations.push(`${rel.split(sep).join('/')}:${index + 1}:${match.index + 1}  ${match[0]}`);
    }
  });
}

if (violations.length > 0) {
  console.error(`lint:tokens — ${violations.length} hardcoded hex colour(s); use a token from tokens.css:\n`);
  for (const violation of violations) console.error(`  ${violation}`);
  process.exit(1);
}
console.log('lint:tokens — no hardcoded hex colours outside src/app/styles/tokens.css');
