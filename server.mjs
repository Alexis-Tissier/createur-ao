import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFolderName, createFolderTree, normalizeTree, sanitizeSegment, writeContactsFile } from './lib/folders.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const PORT = Number(process.env.AO_CREATOR_PORT || 4178);
const DATA_DIR = process.env.AO_CREATOR_DATA_DIR
  ? path.resolve(process.env.AO_CREATOR_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'createur-ao.db');
const DIST_DIR = path.join(ROOT, 'dist');

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS offers (
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
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(destination_id) REFERENCES destinations(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER NOT NULL,
    followup_date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(offer_id) REFERENCES offers(id) ON DELETE CASCADE
  );
`);

const DEFAULT_TREE = [
  {
    id: 'd1',
    name: 'DOSSIER 1',
    children: [
      { id: 'd11', name: 'DOSSIER 1.1', children: [{ id: 'd111', name: 'DOSSIER 1.1.1', children: [] }] },
      { id: 'd12', name: 'DOSSIER 1.2', children: [] },
      { id: 'd13', name: 'DOSSIER 1.3', children: [] }
    ]
  },
  { id: 'd2', name: 'DOSSIER 2', children: [] }
];

const getSetting = db.prepare('SELECT value FROM settings WHERE key = ?');
const putSetting = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

if (!getSetting.get('folder_tree')) {
  putSetting.run('folder_tree', JSON.stringify(DEFAULT_TREE));
}

if (!getSetting.get('bootstrap_complete')) {
  const hasExistingData = Number(db.prepare('SELECT COUNT(*) AS count FROM destinations').get()?.count || 0) > 0
    || Number(db.prepare('SELECT COUNT(*) AS count FROM offers').get()?.count || 0) > 0;
  putSetting.run('bootstrap_complete', hasExistingData ? '1' : '0');
}

function readTree() {
  try {
    return normalizeTree(JSON.parse(getSetting.get('folder_tree')?.value || '[]'));
  } catch {
    return [];
  }
}

function assertNoDuplicateSiblings(nodes, trail = 'racine') {
  const seen = new Set();
  for (const node of nodes) {
    const key = node.name.toLocaleLowerCase('fr');
    if (seen.has(key)) throw new Error(`Deux dossiers portent le même nom dans ${trail} : ${node.name}`);
    seen.add(key);
    assertNoDuplicateSiblings(node.children || [], `${trail} / ${node.name}`);
  }
}

function cleanDestinationPath(value) {
  const result = String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!result) throw new Error('Chemin de destination obligatoire.');
  return result;
}

function bootstrapComplete() {
  return getSetting.get('bootstrap_complete')?.value === '1';
}

function normalizeBootstrapTemplate(value) {
  const template = value && typeof value === 'object' ? value : {};
  if (template.app && template.app !== 'createur-ao') {
    throw new Error('Ce fichier ne correspond pas à Créateur d’AO.');
  }

  const destinations = Array.isArray(template.destinations) ? template.destinations.map((destination) => ({
    name: sanitizeSegment(destination?.name),
    path: cleanDestinationPath(destination?.path)
  })) : [];

  if (!destinations.length) throw new Error('Le modèle ne contient aucune destination.');
  const names = new Set();
  for (const destination of destinations) {
    if (!destination.name) throw new Error('Une destination du modèle n’a pas de nom.');
    const key = destination.name.toLocaleLowerCase('fr');
    if (names.has(key)) throw new Error(`Destination en double dans le modèle : ${destination.name}`);
    names.add(key);
  }

  const tree = normalizeTree(template.tree);
  assertNoDuplicateSiblings(tree);
  return { destinations, tree };
}

function publicSettings() {
  const destinations = db.prepare('SELECT id, name, path FROM destinations ORDER BY name COLLATE NOCASE').all();
  return {
    destinations,
    tree: readTree(),
    onboardingComplete: bootstrapComplete()
  };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, database: DB_FILE });
});

app.get('/api/settings', (_req, res) => {
  res.json(publicSettings());
});

app.post('/api/bootstrap/import', (req, res) => {
  try {
    const { destinations, tree } = normalizeBootstrapTemplate(req.body?.template);
    const sourcePath = String(req.body?.sourcePath || '').trim();

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM destinations').run();
      const insertDestination = db.prepare('INSERT INTO destinations (name, path) VALUES (?, ?)');
      for (const destination of destinations) insertDestination.run(destination.name, destination.path);
      putSetting.run('folder_tree', JSON.stringify(tree));
      putSetting.run('bootstrap_complete', '1');
      putSetting.run('bootstrap_source', sourcePath);
      putSetting.run('bootstrap_imported_at', new Date().toISOString());
    });
    tx();
    res.json(publicSettings());
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

app.post('/api/bootstrap/skip', (_req, res) => {
  putSetting.run('bootstrap_complete', '1');
  putSetting.run('bootstrap_source', '');
  res.json(publicSettings());
});

app.post('/api/destinations', (req, res) => {
  try {
    const name = sanitizeSegment(req.body?.name);
    const destinationPath = cleanDestinationPath(req.body?.path);
    if (!name) throw new Error('Nom de destination obligatoire.');
    const info = db.prepare('INSERT INTO destinations (name, path) VALUES (?, ?)').run(name, destinationPath);
    res.status(201).json(db.prepare('SELECT id, name, path FROM destinations WHERE id = ?').get(info.lastInsertRowid));
  } catch (error) {
    const message = String(error.message || error);
    res.status(message.includes('UNIQUE') ? 409 : 400).json({ error: message.includes('UNIQUE') ? 'Ce nom de destination existe déjà.' : message });
  }
});

app.put('/api/destinations/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = sanitizeSegment(req.body?.name);
    const destinationPath = cleanDestinationPath(req.body?.path);
    if (!name) throw new Error('Nom de destination obligatoire.');
    const info = db.prepare('UPDATE destinations SET name = ?, path = ? WHERE id = ?').run(name, destinationPath, id);
    if (!info.changes) return res.status(404).json({ error: 'Destination introuvable.' });
    res.json(db.prepare('SELECT id, name, path FROM destinations WHERE id = ?').get(id));
  } catch (error) {
    const message = String(error.message || error);
    res.status(message.includes('UNIQUE') ? 409 : 400).json({ error: message.includes('UNIQUE') ? 'Ce nom de destination existe déjà.' : message });
  }
});

app.delete('/api/destinations/:id', (req, res) => {
  const info = db.prepare('DELETE FROM destinations WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: 'Destination introuvable.' });
  res.status(204).end();
});

app.put('/api/tree', (req, res) => {
  try {
    const tree = normalizeTree(req.body?.tree);
    assertNoDuplicateSiblings(tree);
    putSetting.run('folder_tree', JSON.stringify(tree));
    res.json({ tree });
  } catch (error) {
    res.status(400).json({ error: String(error.message || error) });
  }
});

app.get('/api/offers', (_req, res) => {
  const rows = db.prepare(`
    SELECT id, folder_name AS folderName, date_ao AS date, ca, be, title, commercial,
           quote_number AS quoteNumber, contact, destination_name AS destinationName,
           final_path AS finalPath, remark, last_followup_at AS lastFollowupAt,
           followup_count AS followupCount, created_at AS createdAt
    FROM offers
    ORDER BY id DESC
  `).all();
  res.json(rows);
});

app.post('/api/offers', async (req, res) => {
  let finalPath = null;
  try {
    const destinationId = Number(req.body?.destinationId);
    const destination = db.prepare('SELECT id, name, path FROM destinations WHERE id = ?').get(destinationId);
    if (!destination) throw new Error('Choisissez une destination configurée.');

    const payload = {
      date: String(req.body?.date || ''),
      ca: sanitizeSegment(req.body?.ca, { upper: true }),
      be: sanitizeSegment(req.body?.be, { upper: true }),
      title: sanitizeSegment(req.body?.title),
      commercial: sanitizeSegment(req.body?.commercial, { upper: true }),
      quoteNumber: sanitizeSegment(req.body?.quoteNumber, { upper: true }),
      contact: String(req.body?.contact ?? '')
    };

    const folderName = buildFolderName(payload);
    const tree = readTree();
    assertNoDuplicateSiblings(tree);
    finalPath = await createFolderTree({
      fs: fsp,
      basePath: destination.path,
      folderName,
      tree
    });
    await writeContactsFile({ fs: fsp, rootPath: finalPath, contact: payload.contact });

    const insert = db.prepare(`
      INSERT INTO offers (
        folder_name, date_ao, ca, be, title, commercial, quote_number, contact,
        destination_id, destination_name, base_path, final_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = insert.run(
      folderName,
      payload.date,
      payload.ca,
      payload.be,
      payload.title,
      payload.commercial,
      payload.quoteNumber,
      payload.contact,
      destination.id,
      destination.name,
      destination.path,
      finalPath
    );

    res.status(201).json({ id: Number(info.lastInsertRowid), folderName, finalPath });
  } catch (error) {
    if (finalPath) {
      await fsp.rm(finalPath, { recursive: true, force: true }).catch(() => {});
    }
    const code = error?.code === 'EEXIST' ? 409 : error?.code === 'EACCES' || error?.code === 'EPERM' ? 403 : 400;
    let message = String(error.message || error);
    if (error?.code === 'EEXIST') message = 'Un dossier portant ce nom existe déjà dans cette destination.';
    if (error?.code === 'EACCES' || error?.code === 'EPERM') message = 'Accès refusé au dossier de destination.';
    if (error?.code === 'ENOENT') message = 'Le chemin de destination est introuvable.';
    res.status(code).json({ error: message });
  }
});

app.delete('/api/offers/:id', (req, res) => {
  const id = Number(req.params.id);
  const offer = db.prepare('SELECT id FROM offers WHERE id = ?').get(id);
  if (!offer) return res.status(404).json({ error: 'Appel d’offres introuvable.' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM followups WHERE offer_id = ?').run(id);
    db.prepare('DELETE FROM offers WHERE id = ?').run(id);
  });
  tx();
  res.status(204).end();
});

app.patch('/api/offers/:id', (req, res) => {
  const id = Number(req.params.id);
  const remark = String(req.body?.remark ?? '').trim();
  const info = db.prepare('UPDATE offers SET remark = ? WHERE id = ?').run(remark, id);
  if (!info.changes) return res.status(404).json({ error: 'Appel d’offres introuvable.' });
  res.json({ ok: true });
});

app.post('/api/offers/:id/followups', (req, res) => {
  const id = Number(req.params.id);
  const offer = db.prepare('SELECT id FROM offers WHERE id = ?').get(id);
  if (!offer) return res.status(404).json({ error: 'Appel d’offres introuvable.' });

  const followupDate = String(req.body?.date || new Date().toISOString().slice(0, 10));
  const note = String(req.body?.note ?? '').trim();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO followups (offer_id, followup_date, note) VALUES (?, ?, ?)').run(id, followupDate, note);
    db.prepare('UPDATE offers SET last_followup_at = ?, followup_count = followup_count + 1 WHERE id = ?').run(followupDate, id);
  });
  tx();
  res.status(201).json({ ok: true, date: followupDate });
});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Erreur interne.' });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`API interne Créateur d’AO prête sur le port ${PORT}.`);
});

function close() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', close);
process.on('SIGTERM', close);
