import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js');
const children = [];
let closing = false;

function start(command, args, extra = {}) {
  const child = spawn(command, args, { cwd: root, stdio: 'inherit', ...extra });
  children.push(child);
  child.on('exit', (code) => {
    if (!closing && code && code !== 0) stop(code);
  });
  return child;
}

function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 250).unref();
}

async function waitFor(url, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Délai dépassé en attendant ${url}`);
}

start(process.execPath, [path.join(root, 'server.mjs')]);
start(process.execPath, [viteBin, '--host', '127.0.0.1']);

try {
  await waitFor('http://127.0.0.1:5173');
  const electron = start(process.execPath, [electronCli, '.'], {
    env: { ...process.env, AO_DEV_URL: 'http://127.0.0.1:5173' }
  });
  electron.on('exit', (code) => stop(code || 0));
} catch (error) {
  console.error(error.message);
  stop(1);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
