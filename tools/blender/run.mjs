/**
 * Runs a Blender script headlessly, after finding Blender wherever it happens to be.
 *
 *     node tools/blender/run.mjs build_car.py
 *
 * Blender is not on PATH on this machine, and its folder has a space in it, which a plain
 * npm script cannot pass through cmd.exe without mangling. Spawning it from here sidesteps
 * both, and keeps the scripts working on a machine that installed Blender somewhere else.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

// fileURLToPath, not the raw pathname: this project lives in a folder whose name has a space
// in it, which a file URL spells %20 — and no file system will open that.
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** The usual homes for Blender, newest version first. */
function findBlender() {
  if (process.env.BLENDER) return process.env.BLENDER;

  const roots = [
    'C:/Program Files/Blender Foundation',
    'C:/Program Files (x86)/Blender Foundation',
    `${process.env.LOCALAPPDATA ?? ''}/Programs/Blender Foundation`,
    '/Applications',
    '/usr/bin',
    '/usr/local/bin',
  ].filter(Boolean);

  for (const root of roots) {
    if (!existsSync(root)) continue;
    const entries = readdirSync(root).sort().reverse();
    for (const entry of entries) {
      for (const candidate of [
        path.join(root, entry, 'blender.exe'),
        path.join(root, entry, 'Contents/MacOS/Blender'),
        path.join(root, entry),
      ]) {
        if (existsSync(candidate) && /blender(\.exe)?$/i.test(candidate)) return candidate;
      }
    }
  }
  return null;
}

const script = process.argv[2];
if (!script) {
  console.error('usage: node tools/blender/run.mjs <script.py> [blender args…]');
  process.exit(2);
}

const blender = findBlender();
if (!blender) {
  console.error('Blender was not found. Set BLENDER to its executable and run again.');
  process.exit(2);
}

const scriptPath = path.isAbsolute(script) ? script : path.join(HERE, script);
const child = spawn(blender, ['--background', '--python', scriptPath, ...process.argv.slice(3)], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

// Blender is noisy on start-up; only what our scripts say, and anything that went wrong.
const keep = /^(SW:|Error|Traceback|\s+File ")/;
const forward = (stream, out) => {
  let rest = '';
  stream.on('data', chunk => {
    const lines = (rest + chunk.toString()).split('\n');
    rest = lines.pop() ?? '';
    for (const line of lines) if (keep.test(line)) out.write(line + '\n');
  });
};
forward(child.stdout, process.stdout);
forward(child.stderr, process.stderr);

child.on('close', code => process.exit(code ?? 0));
