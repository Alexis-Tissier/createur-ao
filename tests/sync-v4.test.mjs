import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

async function waitFor(url, child) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not become ready');
}

async function request(base, url, options = {}) {
  const response = await fetch(`${base}${url}`, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${response.status} ${url}: ${payload?.error || JSON.stringify(payload)}`);
  return payload;
}

async function startServer(dataDir, computerName, port) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AO_CREATOR_PORT: String(port), AO_CREATOR_DATA_DIR: dataDir, COMPUTERNAME: computerName }
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitFor(`${base}/api/health`, child);
  } catch (error) {
    child.kill('SIGTERM');
    throw new Error(`${error.message}\n${stderr}`);
  }
  return {
    child,
    base,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM');
      await new Promise((resolve) => child.once('exit', resolve));
    }
  };
}

test('deux PC convergent via la base maître et partagent aussi la configuration', { timeout: 30000 }, async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'createur-ao-sync-'));
  const dataA = path.join(root, 'pc-a');
  const dataB = path.join(root, 'pc-b');
  const master = path.join(root, 'master');
  const aoRoot = path.join(root, 'ao-retire');
  await Promise.all([fs.mkdir(dataA), fs.mkdir(dataB), fs.mkdir(master), fs.mkdir(aoRoot)]);

  const portA = 45000 + Math.floor(Math.random() * 400);
  const portB = 45500 + Math.floor(Math.random() * 400);
  const a = await startServer(dataA, 'PC-A', portA);
  let b = null;

  try {
    const destination = await request(a.base, '/api/destinations', {
      method: 'POST',
      body: JSON.stringify({ name: 'AO retiré', path: aoRoot })
    });

    const created = await request(a.base, '/api/offers', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-08-12',
        ca: 'XX',
        be: 'BET',
        client: 'CLIENT',
        title: 'TEST SYNCHRO',
        commercial: 'XX',
        quoteNumber: 'XX',
        contact: 'contact@test.local',
        destinationId: destination.id,
        department: 'CET',
        dueDate: '2026-08-20'
      })
    });

    await request(a.base, '/api/actors/PC-A', {
      method: 'PUT',
      body: JSON.stringify({ displayName: 'Alexis Test' })
    });

    await request(a.base, '/api/settings/shared', {
      method: 'PUT',
      body: JSON.stringify({ masterRoot: master, wonPath: '', lostPath: '' })
    });
    await request(a.base, '/api/sync/run', { method: 'POST' });

    b = await startServer(dataB, 'PC-B', portB);
    await request(b.base, '/api/settings/shared', {
      method: 'PUT',
      body: JSON.stringify({ masterRoot: master, wonPath: '', lostPath: '' })
    });
    await request(b.base, '/api/sync/run', { method: 'POST' });

    const settingsB = await request(b.base, '/api/settings');
    assert.equal(settingsB.destinations.some((d) => d.name === 'AO retiré'), true);

    const offersB = await request(b.base, '/api/offers');
    assert.equal(offersB.length, 1);
    assert.equal(offersB[0].uid, created.uid);
    assert.equal(offersB[0].client, 'CLIENT');
    assert.equal(offersB[0].department, 'CET');

    await request(b.base, `/api/offers/${created.uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'envoye' })
    });
    await request(b.base, '/api/sync/run', { method: 'POST' });
    await request(a.base, '/api/sync/run', { method: 'POST' });

    const offersA = await request(a.base, '/api/offers');
    assert.equal(offersA.length, 1);
    assert.equal(offersA[0].status, 'envoye');
    assert.equal(offersA[0].lastActorPc, 'PC-B');

    const logsA = await request(a.base, '/api/logs');
    assert.equal(logsA.some((entry) => entry.action === 'Suivi AO modifié' && entry.actorPcId === 'PC-B'), true);
  } finally {
    await b?.stop();
    await a.stop();
    await fs.rm(root, { recursive: true, force: true });
  }
});
