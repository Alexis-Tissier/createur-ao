import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

async function waitFor(url, child) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('server did not become ready');
}

test('v0.4 démarre et migre une base v0.3', { timeout: 20000 }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'createur-ao-v4-'));
  const dbFile = path.join(dir, 'createur-ao.db');
  const legacy = new Database(dbFile);
  legacy.exec(`
    CREATE TABLE destinations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_name TEXT NOT NULL,
      date_ao TEXT NOT NULL,
      ca TEXT NOT NULL,
      be TEXT NOT NULL,
      title TEXT NOT NULL,
      commercial TEXT NOT NULL DEFAULT '',
      quote_number TEXT NOT NULL,
      contact TEXT NOT NULL DEFAULT '',
      destination_id INTEGER,
      destination_name TEXT NOT NULL,
      base_path TEXT NOT NULL,
      final_path TEXT NOT NULL,
      remark TEXT NOT NULL DEFAULT '',
      last_followup_at TEXT,
      followup_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER NOT NULL,
      followup_date TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO offers (folder_name,date_ao,ca,be,title,commercial,quote_number,contact,destination_name,base_path,final_path)
      VALUES ('2026_08_01_XX_BE_TEST__','2026-08-01','XX','BE','TEST','','','','AO retiré','C:/AO','C:/AO/test');
  `);
  legacy.close();

  const port = 43000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, AO_CREATOR_PORT: String(port), AO_CREATOR_DATA_DIR: dir, COMPUTERNAME: 'ATISSIER-TEST' }
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  try {
    const health = await waitFor(`http://127.0.0.1:${port}/api/health`, child);
    assert.equal(health.ok, true);
    assert.equal(health.peerId, 'ATISSIER-TEST');
  } catch (error) {
    throw new Error(`${error.message}\n${stderr}`);
  } finally {
    child.kill('SIGTERM');
    await new Promise((r) => child.once('exit', r));
  }

  const migrated = new Database(dbFile, { readonly: true });
  const columns = migrated.prepare('PRAGMA table_info(offers)').all().map((r) => r.name);
  assert.ok(columns.includes('client'));
  assert.ok(columns.includes('status'));
  assert.ok(columns.includes('updated_at'));
  const row = migrated.prepare('SELECT uid, client, status, updated_at FROM offers LIMIT 1').get();
  assert.ok(row.uid);
  assert.equal(row.client, '');
  assert.equal(row.status, 'a_attribuer');
  assert.ok(row.updated_at);
  migrated.close();
  await fs.rm(dir, { recursive: true, force: true });
});
