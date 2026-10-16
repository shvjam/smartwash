/**
 * Starts the local-model setup for Blender: a model served by llama.cpp, and the Blender MCP
 * server bridging it to a running Blender.
 *
 *     node tools/blender/llama.mjs
 *
 * Three processes have to be alive for this to work, and this starts the two that are ours:
 *
 *   1. Blender, with the MCP add-on — opens its socket on 9876 a second after it launches.
 *   2. llama-server — serves the model and a chat page on 8080.
 *   3. blender-mcp over HTTP on 9191 — what the chat page calls to reach Blender.
 *
 * Blender itself is left to you: this will not open a 3D application behind your back.
 *
 * The model runs on this machine's own hardware, so nothing typed into that chat page leaves
 * it. That is the whole point of the local setup; it is also why a 4B model is what fits.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOME = process.env.USERPROFILE ?? process.env.HOME ?? '';

const LLAMA = process.env.LLAMA_SERVER
  ?? path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft/WinGet/Packages/ggml.llamacpp_Microsoft.Winget.Source_8wekyb3d8bbwe/llama-server.exe');
const MCP = path.join(HERE, '.venv/Scripts/blender-mcp.exe');
const MODELS = process.env.LLAMA_MODELS ?? path.join(HOME, 'models');

const LLAMA_PORT = 8080;
const MCP_PORT = 9191;
const BLENDER_PORT = 9876;

/** The newest .gguf in the models folder, unless one is named on the command line. */
function pickModel() {
  const named = process.argv[2];
  if (named) return path.isAbsolute(named) ? named : path.join(MODELS, named);
  if (!existsSync(MODELS)) return null;
  const models = readdirSync(MODELS).filter(f => f.endsWith('.gguf')).sort();
  return models.length ? path.join(MODELS, models[models.length - 1]) : null;
}

const isListening = port => new Promise(resolve => {
  const socket = net.connect({ port, host: '127.0.0.1' }, () => { socket.end(); resolve(true); });
  socket.on('error', () => resolve(false));
  setTimeout(() => { socket.destroy(); resolve(false); }, 700);
});

const model = pickModel();
if (!model || !existsSync(model)) {
  console.error(`No model found in ${MODELS}. Download a .gguf there, or pass one as an argument.`);
  process.exit(2);
}
if (!existsSync(LLAMA)) {
  console.error('llama-server was not found. Install it with: winget install ggml.llamacpp');
  process.exit(2);
}

if (!await isListening(BLENDER_PORT)) {
  console.log(`! Blender is not listening on ${BLENDER_PORT}. Open Blender first — the add-on`);
  console.log('  starts its server by itself a second later. Carrying on regardless.');
}

const children = [];
const start = (name, command, args) => {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `[${name}] `;
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', text => process.stdout.write(text.replace(/^/gm, tag)));
  }
  child.on('exit', code => console.log(`${tag}exited (${code})`));
  children.push(child);
  return child;
};

console.log(`model : ${path.basename(model)}`);
console.log(`chat  : http://127.0.0.1:${LLAMA_PORT}/`);
console.log(`mcp   : http://127.0.0.1:${MCP_PORT}/   (point the chat page's MCP settings here)`);
console.log('');

start('llama', LLAMA, [
  '-m', model,
  '--port', String(LLAMA_PORT),
  // Everything that fits goes to the Intel GPU through Vulkan; the rest stays on the CPU.
  '-ngl', '99',
  '--ctx-size', '8192',
  '--jinja',          // the chat template the model ships with, which is what carries tool calls
]);

start('mcp', MCP, ['--transport', 'http', '--port', String(MCP_PORT)]);

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
