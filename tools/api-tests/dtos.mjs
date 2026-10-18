/**
 * Compares the fields of every C# DTO with the TypeScript type of the same name.
 *
 * A route can match perfectly and the screen still be wrong, because the shapes drift: a
 * field renamed on the server keeps compiling in the browser and reads as `undefined`, which
 * TypeScript cannot see because the type was written by hand. This prints, per DTO:
 *
 *   ts-only  — the frontend type declares it, the server never sends it. Anything reading it
 *              gets undefined: a blank cell, a NaN total, a condition that is never true.
 *   cs-only  — the server sends it and the frontend type has never heard of it. Data the UI
 *              could show and does not.
 *
 * Only names that exist on both sides are compared, so a type with no C# twin is ignored.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walk = (dir, ext) => readdirSync(dir).flatMap(name => {
  const p = join(dir, name);
  if (statSync(p).isDirectory()) return ['bin', 'obj', 'node_modules', 'Migrations'].includes(name) ? [] : walk(p, ext);
  return p.endsWith(ext) ? [p] : [];
});
const camel = s => s[0].toLowerCase() + s.slice(1);

/* ── C#: positional records ending in Dto ── */
const cs = new Map();
for (const file of walk(join(root, 'backend', 'src'), '.cs')) {
  const src = readFileSync(file, 'utf8');
  const re = /record\s+(\w+Dto)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = re.lastIndex;
    while (i < src.length && depth) { if (src[i] === '(') depth++; else if (src[i] === ')') depth--; i++; }
    const params = src.slice(re.lastIndex, i - 1)
      .replace(/\/\/.*$/gm, '')                         // comments between parameters
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/<[^<>]*(<[^<>]*>[^<>]*)*>/g, '')        // generic arguments carry commas
      .replace(/\[[^\]]*\]/g, '')                       // attributes
      .split(',')
      .map(p => p.trim().replace(/\s*=.*$/, '').split(/\s+/).pop())
      .filter(Boolean)
      .map(camel);
    cs.set(m[1], { fields: new Set(params), file: file.slice(root.length + 1) });
  }
}

/*
  Where the frontend deliberately names a type differently from the record it mirrors. Without
  this the comparison pairs the wrong two — the platform's subscription list is typed as
  SubscriptionDto in the browser but is AdminSubscriptionDto on the server, and comparing it
  against the tenant's own SubscriptionDto reports three missing fields that are not missing.
*/
const ALIASES = {
  SubscriptionDto: 'AdminSubscriptionDto',
  CurrentSubscriptionDto: 'SubscriptionDto',
  TenantAdminDto: 'TenantSummaryDto',
  CurrentTenantDto: 'TenantDto',
  AuthUserDto: 'AuthenticatedUserDto',
  WalletTxDto: 'WalletTransactionDto',
  LoyaltyTxDto: 'LoyaltyTransactionDto',
  TenantInvoiceDto: 'InvoiceDto',
  TenantDetailInvoiceDto: 'TenantInvoiceDto',
};

/* ── TypeScript: `export type XxxDto = { ... }` and `export interface XxxDto { ... }` ── */
const ts = new Map();
for (const file of walk(join(root, 'frontend', 'src'), '.ts')) {
  const src = readFileSync(file, 'utf8');
  const re = /export\s+(?:type\s+(\w+Dto)\s*=|interface\s+(\w+Dto)(?:\s+extends\s+[\w<>, ]+)?)\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = re.lastIndex;
    while (i < src.length && depth) { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; }
    // Only the top level: nested object literals belong to the field that holds them.
    let body = '', d = 0;
    for (const ch of src.slice(re.lastIndex, i - 1)) {
      if (ch === '{') d++;
      if (d === 0) body += ch;
      if (ch === '}') d--;
    }
    const fields = [...body
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/(?:^|[;\n,{])\s*(?:readonly\s+)?(\w+)\??\s*:/g)].map(x => x[1]);
    const tsName = m[1] ?? m[2];
    ts.set(tsName, { fields: new Set(fields), file: file.slice(root.length + 1) });
  }
}

let problems = 0;
const twin = n => ALIASES[n] ?? n;
const names = [...ts.keys()].filter(n => cs.has(twin(n))).sort();
for (const name of names) {
  const a = cs.get(twin(name)).fields, b = ts.get(name).fields;
  const tsOnly = [...b].filter(f => !a.has(f));
  const csOnly = [...a].filter(f => !b.has(f));
  if (!tsOnly.length && !csOnly.length) continue;
  problems += tsOnly.length;
  console.log(`\n${name}`);
  if (tsOnly.length) console.log(`  ts-only  ${tsOnly.join(', ')}`);
  if (csOnly.length) console.log(`  cs-only  ${csOnly.join(', ')}`);
}
const unpaired = [...ts.keys()].filter(n => !cs.has(twin(n))).sort();
console.log(`\ncompared ${names.length} DTOs · ${problems} field(s) the frontend expects and never receives`);
if (unpaired.length) console.log(`frontend types with no C# record of that name: ${unpaired.join(', ')}`);
