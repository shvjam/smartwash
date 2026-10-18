/**
 * Lists the frontend API wrappers that no screen ever calls.
 *
 * contract.mjs proves every route has a wrapper. That is not the same as having a way in: a
 * wrapper can sit in modules.ts for months with nothing calling it, which means the backend
 * feature behind it is reachable from curl and from nowhere else. Each line printed here is a
 * capability the API has and the panel does not offer.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'frontend', 'src', 'app');
const walk = dir => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return walk(p);
  return /\.(ts|tsx)$/.test(name) ? [p] : [];
});

const modules = readFileSync(join(app, 'api', 'modules.ts'), 'utf8');
const callers = walk(app)
  .filter(f => !relative(app, f).startsWith('api'))
  .map(f => readFileSync(f, 'utf8'))
  .join('\n');

const unused = [];
for (const [, obj, body] of modules.matchAll(/export const (\w+Api)\s*=\s*\{([\s\S]*?)\n\};/g)) {
  for (const [, method] of body.matchAll(/^ {2}(\w+)\s*[:(]/gm)) {
    const used = new RegExp(`\\b${obj}\\s*\\.\\s*${method}\\b`).test(callers);
    if (!used) unused.push(`${obj}.${method}`);
  }
}

console.log(`${unused.length} wrapper(s) with no caller`);
for (const u of unused) console.log(`  ${u}`);
