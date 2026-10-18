/**
 * Compares the routes the backend exposes with the routes the frontend calls.
 *
 * Two lists that are maintained by hand in two languages drift apart quietly: a route renamed
 * on one side keeps compiling on the other and fails only when someone presses the button. So
 * the comparison is mechanical. It prints three things:
 *
 *   broken   — the frontend calls it and the backend has no such route. Always a bug.
 *   unused   — the backend has it and no screen calls it. A feature without a way in.
 *   matched  — the count, as a sanity check that the parser saw both sides.
 *
 * Paths are normalised so that `${id}` on one side and `{id:guid}` on the other compare equal.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const controllers = join(root, 'backend', 'src', 'SmartWash.Api', 'Controllers');
const frontendSrc = join(root, 'frontend', 'src');

const walk = (dir, ext) => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : walk(p, ext);
  return p.endsWith(ext) ? [p] : [];
});

const norm = path => '/' + path
  .replace(/\/{2,}/g, '/')
  .replace(/^\/+/, '')
  .replace(/\$\{[^}]+\}/g, '{}')
  .replace(/\{[^}]+\}/g, '{}')
  .replace(/\/+$/, '')
  .toLowerCase();

/* ── backend ── */
const backend = new Map();
for (const file of walk(controllers, '.cs')) {
  const src = readFileSync(file, 'utf8');
  const base = (src.match(/\[Route\("([^"]*)"\)\]/) ?? [])[1] ?? '';
  const re = /\[Http(Get|Post|Put|Patch|Delete)(?:\("([^"]*)"\))?\]/g;
  let m;
  while ((m = re.exec(src))) {
    const verb = m[1].toUpperCase();
    const full = norm([base, m[2] ?? ''].filter(Boolean).join('/'));
    backend.set(`${verb} ${full}`, file.slice(controllers.length + 1));
  }
}

/* ── frontend ── */
const prefixFor = scope => ({ tenant: '/api', platform: '/api/platform', public: '/api/public', cron: '/api/cron' })[scope];
const frontend = new Map();
for (const file of walk(frontendSrc, '.ts').concat(walk(frontendSrc, '.tsx'))) {
  const src = readFileSync(file, 'utf8');
  // The type argument can nest (`<PagedList<OrderDto>>`), so skip lazily to the opening
  // parenthesis rather than trying to balance angle brackets.
  const re = /api\.(get|post|put|patch|delete)\b[^(]*?\(\s*[`'"]([^`'"]+)[`'"]([^)]*)\)/g;
  let m;
  while ((m = re.exec(src))) {
    const verb = m[1].toUpperCase();
    const scope = (m[3].match(/'(tenant|platform|public|cron)'\s*$/) ?? [])[1] ?? 'tenant';
    // A trailing `${qs}` glued straight onto the path is a query string, not a segment.
    const path = m[2].replace(/\?.*$/, '').replace(/([^/])\$\{[^}]+\}$/, '$1');
    const full = norm(prefixFor(scope) + '/' + path);
    const key = `${verb} ${full}`;
    if (!frontend.has(key)) frontend.set(key, file.slice(frontendSrc.length + 1));
  }
}

const broken = [...frontend.keys()].filter(k => !backend.has(k)).sort();
const unused = [...backend.keys()].filter(k => !frontend.has(k) && !k.includes('/api/cron/')).sort();

console.log(`backend routes: ${backend.size}   frontend calls: ${frontend.size}   matched: ${frontend.size - broken.length}\n`);
console.log(`── broken (${broken.length}) — the frontend calls a route that does not exist`);
for (const k of broken) console.log(`  ${k.padEnd(62)} ${frontend.get(k)}`);
console.log(`\n── unused (${unused.length}) — the backend exposes a route no screen calls`);
for (const k of unused) console.log(`  ${k.padEnd(62)} ${backend.get(k)}`);
process.exit(broken.length ? 1 : 0);
