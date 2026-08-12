import express from 'express';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  buildFolderName,
  createFolderTree,
  normalizeTree,
  parseFolderName,
  sanitizeSegment,
  writeContactsFile
} from './lib/folders-v4.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);
const PORT = Number(process.env.AO_CREATOR_PORT || 4178);
const DATA_DIR = process.env.AO_CREATOR_DATA_DIR
  ? path.resolve(process.env.AO_CREATOR_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'createur-ao.db');
const DIST_DIR = path.join(ROOT, 'dist');
const PEER_ID = sanitizePeer(process.env.COMPUTERNAME || os.hostname() || 'PC-INCONNU');
const SYNC_INTERVAL_MS = 5000;
const STATUS_SCAN_INTERVAL_MS = 60000;
const STATUS_VALUES = new Set(['a_attribuer', 'en_cours', 'envoye', 'gagne', 'perdu']);

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

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
    uid TEXT UNIQUE,
    folder_name TEXT NOT NULL,
    date_ao TEXT NOT NULL,
    ca TEXT NOT NULL,
    be TEXT NOT NULL DEFAULT '',
    client TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    commercial TEXT NOT NULL DEFAULT '',
    quote_number TEXT NOT NULL DEFAULT '',
    contact TEXT NOT NULL DEFAULT '',
    destination_id INTEGER,
    destination_name TEXT NOT NULL DEFAULT '',
    base_path TEXT NOT NULL DEFAULT '',
    final_path TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'a_attribuer',
    due_date TEXT NOT NULL DEFAULT '',
    remark TEXT NOT NULL DEFAULT '',
    created_by_pc TEXT NOT NULL DEFAULT '',
    last_actor_pc TEXT NOT NULL DEFAULT '',
    last_followup_at TEXT,
    followup_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(destination_id) REFERENCES destinations(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS followups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT UNIQUE,
    offer_uid TEXT NOT NULL,
    followup_date TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    actor_pc_id TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS actors (
    pc_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS activity_log (
    event_id TEXT PRIMARY KEY,
    offer_uid TEXT,
    actor_pc_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sync_events (
    event_id TEXT PRIMARY KEY,
    peer_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    type TEXT NOT NULL,
    offer_uid TEXT,
    payload_json TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    department TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    exported INTEGER NOT NULL DEFAULT 0,
    UNIQUE(peer_id, seq)
  );
  CREATE TABLE IF NOT EXISTS sync_peers (
    peer_id TEXT PRIMARY KEY,
    last_seq INTEGER NOT NULL DEFAULT 0
  );
`);

for (const [column, sql] of [
  ['uid', "ALTER TABLE offers ADD COLUMN uid TEXT"],
  ['client', "ALTER TABLE offers ADD COLUMN client TEXT NOT NULL DEFAULT ''"],
  ['department', "ALTER TABLE offers ADD COLUMN department TEXT NOT NULL DEFAULT ''"],
  ['status', "ALTER TABLE offers ADD COLUMN status TEXT NOT NULL DEFAULT 'a_attribuer'"],
  ['due_date', "ALTER TABLE offers ADD COLUMN due_date TEXT NOT NULL DEFAULT ''"],
  ['created_by_pc', "ALTER TABLE offers ADD COLUMN created_by_pc TEXT NOT NULL DEFAULT ''"],
  ['last_actor_pc', "ALTER TABLE offers ADD COLUMN last_actor_pc TEXT NOT NULL DEFAULT ''"],
  ['updated_at', "ALTER TABLE offers ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"]
]) ensureColumn('offers', column, sql);

for (const [column, sql] of [
  ['event_id', "ALTER TABLE followups ADD COLUMN event_id TEXT"],
  ['offer_uid', "ALTER TABLE followups ADD COLUMN offer_uid TEXT NOT NULL DEFAULT ''"],
  ['actor_pc_id', "ALTER TABLE followups ADD COLUMN actor_pc_id TEXT NOT NULL DEFAULT ''"]
]) ensureColumn('followups', column, sql);

function legacyOfferUid(folderName) {
  const digest = crypto.createHash('sha256').update(String(folderName || '').toLocaleLowerCase('fr')).digest('hex').slice(0, 32);
  return `legacy-${digest}`;
}
const legacyRows = db.prepare("SELECT id, folder_name FROM offers WHERE uid IS NULL OR uid = ''").all();
const setLegacyUid = db.prepare('UPDATE offers SET uid = ? WHERE id = ?');
for (const row of legacyRows) setLegacyUid.run(legacyOfferUid(row.folder_name), row.id);
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_uid ON offers(uid)');
db.prepare("UPDATE offers SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at = '' OR updated_at IS NULL").run();
const followupColumns = new Set(db.prepare('PRAGMA table_info(followups)').all().map((row) => row.name));
if (followupColumns.has('offer_id')) {
  db.prepare("UPDATE followups SET offer_uid = COALESCE((SELECT uid FROM offers WHERE offers.id = followups.offer_id), offer_uid) WHERE offer_uid = ''").run();
}
db.prepare("UPDATE followups SET event_id = 'legacy-followup-' || id WHERE event_id IS NULL OR event_id = ''").run();
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_followups_event_id ON followups(event_id)');

db.prepare(`
  INSERT INTO actors (pc_id, display_name, updated_at) VALUES (?, '', ?)
  ON CONFLICT(pc_id) DO NOTHING
`).run(PEER_ID, nowIso());

const DEFAULT_TREE = [
  { id: 'd1', name: 'DOSSIER 1', children: [] },
  { id: 'd2', name: 'DOSSIER 2', children: [] }
];
const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const putSettingStmt = db.prepare(`
  INSERT INTO settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);
if (!getSetting('folder_tree')) putSetting('folder_tree', JSON.stringify(DEFAULT_TREE));
if (!getSetting('bootstrap_complete')) {
  const hasData = Number(db.prepare('SELECT COUNT(*) AS count FROM destinations').get()?.count || 0) > 0;
  putSetting('bootstrap_complete', hasData ? '1' : '0');
}

function ensureColumn(table, column, sql) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) db.exec(sql);
}
function sanitizePeer(value) {
  return String(value || 'PC-INCONNU').trim().toUpperCase().replace(/[^A-Z0-9._-]+/g, '-').slice(0, 80) || 'PC-INCONNU';
}
function nowIso() { return new Date().toISOString(); }
function getSetting(key) { return getSettingStmt.get(key)?.value || ''; }
function putSetting(key, value) { putSettingStmt.run(key, String(value ?? '')); }
function readTree() {
  try { return normalizeTree(JSON.parse(getSetting('folder_tree') || '[]')); }
  catch { return []; }
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
  const result = String(value ?? '').trim().replace(/^[\"']|[\"']$/g, '');
  if (!result) throw new Error('Chemin de destination obligatoire.');
  return result;
}
function normalizeStatus(value) {
  const status = String(value || 'a_attribuer');
  return STATUS_VALUES.has(status) ? status : 'a_attribuer';
}
function publicSettings() {
  return {
    destinations: db.prepare('SELECT id, name, path FROM destinations ORDER BY name COLLATE NOCASE').all(),
    tree: readTree(),
    onboardingComplete: getSetting('bootstrap_complete') === '1',
    masterRoot: getSetting('master_root'),
    wonPath: getSetting('won_path'),
    lostPath: getSetting('lost_path'),
    peerId: PEER_ID
  };
}
function sharedConfigSnapshot() {
  return {
    destinations: db.prepare('SELECT name, path FROM destinations ORDER BY name COLLATE NOCASE').all(),
    tree: readTree(),
    updatedAt: getSetting('shared_config_updated_at') || '',
    actorPcId: getSetting('shared_config_actor') || ''
  };
}
function configIsNewer(snapshot, actorPc='') {
  const incomingAt=String(snapshot?.updatedAt||'');
  const currentAt=getSetting('shared_config_updated_at');
  if(incomingAt>currentAt)return true;
  if(incomingAt<currentAt)return false;
  return sanitizePeer(actorPc||snapshot?.actorPcId||'')>sanitizePeer(getSetting('shared_config_actor'));
}
function applySharedConfigSnapshot(snapshot, actorPc='') {
  if(!snapshot||!Array.isArray(snapshot.destinations)||!Array.isArray(snapshot.tree))return false;
  if(!configIsNewer(snapshot,actorPc))return false;
  const normalized=snapshot.destinations.map(d=>({name:sanitizeSegment(d?.name),path:String(d?.path||'').trim()})).filter(d=>d.name&&d.path);
  const tree=normalizeTree(snapshot.tree);
  assertNoDuplicateSiblings(tree);
  const tx=db.transaction(()=>{
    const keep=new Set(normalized.map(d=>d.name.toLocaleLowerCase('fr')));
    const existing=db.prepare('SELECT id,name FROM destinations').all();
    const upsert=db.prepare(`INSERT INTO destinations (name,path) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET path=excluded.path`);
    for(const d of normalized)upsert.run(d.name,d.path);
    const remove=db.prepare('DELETE FROM destinations WHERE id=?');
    for(const d of existing)if(!keep.has(d.name.toLocaleLowerCase('fr')))remove.run(d.id);
    putSetting('folder_tree',JSON.stringify(tree));
    putSetting('shared_config_updated_at',String(snapshot.updatedAt||nowIso()));
    putSetting('shared_config_actor',sanitizePeer(actorPc||snapshot.actorPcId||''));
  });
  tx();
  return true;
}
function queueSharedConfig(action='Configuration partagée modifiée') {
  const at=nowIso();
  putSetting('shared_config_updated_at',at);
  putSetting('shared_config_actor',PEER_ID);
  const config=sharedConfigSnapshot();
  queueEvent({type:'config.snapshot',payload:{config},action,details:`${config.destinations.length} destination(s) · arborescence partagée`});
}

function actorName(pcId) {
  const row = db.prepare('SELECT display_name FROM actors WHERE pc_id = ?').get(pcId);
  return row?.display_name || pcId || '—';
}
function offerPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    uid: row.uid,
    folderName: row.folder_name,
    date: row.date_ao,
    ca: row.ca,
    be: row.be,
    client: row.client,
    title: row.title,
    commercial: row.commercial,
    quoteNumber: row.quote_number,
    contact: row.contact,
    destinationId: row.destination_id,
    destinationName: row.destination_name,
    basePath: row.base_path,
    finalPath: row.final_path,
    department: row.department,
    status: row.status,
    dueDate: row.due_date,
    remark: row.remark,
    createdByPc: row.created_by_pc,
    createdByName: actorName(row.created_by_pc),
    lastActorPc: row.last_actor_pc,
    lastActorName: actorName(row.last_actor_pc),
    lastFollowupAt: row.last_followup_at,
    followupCount: row.followup_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function offerByUid(uid) { return db.prepare('SELECT * FROM offers WHERE uid = ?').get(uid); }
function nextLocalSeq() {
  return Number(db.prepare('SELECT COALESCE(MAX(seq), 0) AS value FROM sync_events WHERE peer_id = ?').get(PEER_ID)?.value || 0) + 1;
}
function addLog(event) {
  db.prepare(`
    INSERT OR IGNORE INTO activity_log
      (event_id, offer_uid, actor_pc_id, action, details, department, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(event.eventId, event.offerUid || null, event.peerId, event.action, event.details || '', event.department || '', event.status || '', event.createdAt);
}
function queueEvent({ type, offerUid = null, payload = {}, action, details = '', department = '', status = '' }) {
  const event = {
    eventId: crypto.randomUUID(),
    peerId: PEER_ID,
    seq: nextLocalSeq(),
    type,
    offerUid,
    payload,
    action,
    details,
    department,
    status,
    createdAt: nowIso()
  };
  db.prepare(`
    INSERT INTO sync_events
      (event_id, peer_id, seq, type, offer_uid, payload_json, action, details, department, status, created_at, exported)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(event.eventId, event.peerId, event.seq, event.type, event.offerUid, JSON.stringify(event.payload), event.action, event.details, event.department, event.status, event.createdAt);
  addLog(event);
  return event;
}
function serializeOffer(row) {
  return offerPublic(row);
}
function shouldApplyOfferSnapshot(existing, snapshot, actorPc = '') {
  if (!existing) return true;
  const incomingAt = String(snapshot?.updatedAt || snapshot?.createdAt || '');
  const currentAt = String(existing.updated_at || existing.created_at || '');
  if (incomingAt > currentAt) return true;
  if (incomingAt < currentAt) return false;
  const incomingActor = sanitizePeer(actorPc || snapshot?.lastActorPc || snapshot?.createdByPc || '');
  const currentActor = sanitizePeer(existing.last_actor_pc || existing.created_by_pc || '');
  return incomingActor > currentActor;
}
function upsertOfferSnapshot(snapshot, actorPc = '') {
  if (!snapshot?.uid) return false;
  const existing = offerByUid(snapshot.uid);
  if (!shouldApplyOfferSnapshot(existing, snapshot, actorPc)) return false;
  const params = {
    uid: snapshot.uid,
    folderName: snapshot.folderName || '', date: snapshot.date || '', ca: snapshot.ca || 'XX', be: snapshot.be || '', client: snapshot.client || '',
    title: snapshot.title || '', commercial: snapshot.commercial || '', quoteNumber: snapshot.quoteNumber || '', contact: snapshot.contact || '',
    destinationId: snapshot.destinationId || null, destinationName: snapshot.destinationName || '', basePath: snapshot.basePath || '', finalPath: snapshot.finalPath || '',
    department: snapshot.department || '', status: normalizeStatus(snapshot.status), dueDate: snapshot.dueDate || '', remark: snapshot.remark || '',
    createdByPc: snapshot.createdByPc || actorPc || '', lastActorPc: actorPc || snapshot.lastActorPc || '',
    lastFollowupAt: snapshot.lastFollowupAt || null, followupCount: Number(snapshot.followupCount || 0),
    createdAt: snapshot.createdAt || nowIso(), updatedAt: snapshot.updatedAt || nowIso()
  };
  if (existing) {
    db.prepare(`UPDATE offers SET folder_name=@folderName,date_ao=@date,ca=@ca,be=@be,client=@client,title=@title,commercial=@commercial,
      quote_number=@quoteNumber,contact=@contact,destination_id=@destinationId,destination_name=@destinationName,base_path=@basePath,final_path=@finalPath,
      department=@department,status=@status,due_date=@dueDate,remark=@remark,created_by_pc=@createdByPc,last_actor_pc=@lastActorPc,
      last_followup_at=@lastFollowupAt,followup_count=@followupCount,updated_at=@updatedAt WHERE uid=@uid`).run(params);
  } else {
    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,
      department,status,due_date,remark,created_by_pc,last_actor_pc,last_followup_at,followup_count,created_at,updated_at)
      VALUES (@uid,@folderName,@date,@ca,@be,@client,@title,@commercial,@quoteNumber,@contact,@destinationId,@destinationName,@basePath,@finalPath,
      @department,@status,@dueDate,@remark,@createdByPc,@lastActorPc,@lastFollowupAt,@followupCount,@createdAt,@updatedAt)`).run(params);
  }
  return true;
}
function applyRemoteEvent(event) {
  if (!event?.eventId || db.prepare('SELECT 1 FROM sync_events WHERE event_id = ?').get(event.eventId)) return false;
  const payload = event.payload || {};
  const tx = db.transaction(() => {
    if (event.type === 'offer.snapshot') upsertOfferSnapshot(payload.offer, event.peerId);
    if (event.type === 'offer.delete' && event.offerUid) db.prepare('DELETE FROM offers WHERE uid = ?').run(event.offerUid);
    if (event.type === 'followup.add') {
      db.prepare(`INSERT OR IGNORE INTO followups (event_id, offer_uid, followup_date, note, actor_pc_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(event.eventId, event.offerUid, payload.date || '', payload.note || '', event.peerId, event.createdAt);
      if (event.offerUid) {
        db.prepare('UPDATE offers SET last_followup_at = ?, followup_count = followup_count + 1, last_actor_pc = ?, updated_at = ? WHERE uid = ?')
          .run(payload.date || '', event.peerId, event.createdAt, event.offerUid);
      }
    }
    if (event.type === 'config.snapshot') {
      applySharedConfigSnapshot(payload.config, event.peerId);
    }
    if (event.type === 'actor.set') {
      db.prepare(`INSERT INTO actors (pc_id, display_name, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(pc_id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at
        WHERE excluded.updated_at > actors.updated_at
           OR (excluded.updated_at = actors.updated_at AND excluded.display_name > actors.display_name)`)
        .run(payload.pcId, payload.displayName || '', event.createdAt);
    }
    db.prepare(`INSERT INTO sync_events (event_id,peer_id,seq,type,offer_uid,payload_json,action,details,department,status,created_at,exported)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`)
      .run(event.eventId, event.peerId, Number(event.seq || 0), event.type, event.offerUid || null, JSON.stringify(payload), event.action || 'Synchronisation', event.details || '', event.department || '', event.status || '', event.createdAt || nowIso());
    addLog(event);
  });
  tx();
  return true;
}
function masterBaseDir() {
  const root = getSetting('master_root');
  return root ? path.join(root, 'Createur-AO-Base') : '';
}
async function writeAtomic(file, text) {
  const tmp = `${file}.${PEER_ID}.${process.pid}.${Date.now()}.tmp`;
  await fsp.writeFile(tmp, text, 'utf8');
  await fsp.rename(tmp, file);
}
async function ensureMasterFolders() {
  const base = masterBaseDir();
  if (!base) return '';
  await fsp.mkdir(path.join(base, 'peers', PEER_ID, 'events'), { recursive: true });
  await fsp.mkdir(path.join(base, 'locks'), { recursive: true });
  return base;
}
async function masterHasOtherPeerData(base) {
  const peersRoot=path.join(base,'peers');
  const entries=await fsp.readdir(peersRoot,{withFileTypes:true}).catch(()=>[]);
  for(const entry of entries){
    if(!entry.isDirectory()||sanitizePeer(entry.name)===PEER_ID)continue;
    try{const index=JSON.parse(await fsp.readFile(path.join(peersRoot,entry.name,'index.json'),'utf8'));if(Number(index?.latest||0)>0)return true;}catch{}
  }
  return false;
}

async function pushLocalEvents(base) {
  const peerDir = path.join(base, 'peers', PEER_ID);
  const eventsDir = path.join(peerDir, 'events');
  const rows = db.prepare('SELECT * FROM sync_events WHERE peer_id = ? AND exported = 0 ORDER BY seq').all(PEER_ID);
  let latest = Number(db.prepare('SELECT COALESCE(MAX(seq),0) AS n FROM sync_events WHERE peer_id = ?').get(PEER_ID)?.n || 0);
  for (const row of rows) {
    const event = {
      eventId: row.event_id, peerId: row.peer_id, seq: row.seq, type: row.type, offerUid: row.offer_uid,
      payload: JSON.parse(row.payload_json || '{}'), action: row.action, details: row.details, department: row.department,
      status: row.status, createdAt: row.created_at
    };
    const file = path.join(eventsDir, `${String(row.seq).padStart(12, '0')}.json`);
    if (!fs.existsSync(file)) await writeAtomic(file, `${JSON.stringify(event)}\n`);
    db.prepare('UPDATE sync_events SET exported = 1 WHERE event_id = ?').run(row.event_id);
  }
  await writeAtomic(path.join(peerDir, 'index.json'), `${JSON.stringify({ peerId: PEER_ID, latest, updatedAt: nowIso() })}\n`);
}
async function pullRemoteEvents(base) {
  const peersRoot = path.join(base, 'peers');
  const entries = await fsp.readdir(peersRoot, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const peer = sanitizePeer(entry.name);
    if (peer === PEER_ID) continue;
    const indexFile = path.join(peersRoot, entry.name, 'index.json');
    let index;
    try { index = JSON.parse(await fsp.readFile(indexFile, 'utf8')); } catch { continue; }
    const latest = Number(index?.latest || 0);
    let last = Number(db.prepare('SELECT last_seq FROM sync_peers WHERE peer_id = ?').get(peer)?.last_seq || 0);
    for (let seq = last + 1; seq <= latest; seq += 1) {
      const file = path.join(peersRoot, entry.name, 'events', `${String(seq).padStart(12, '0')}.json`);
      let event;
      try { event = JSON.parse(await fsp.readFile(file, 'utf8')); } catch { break; }
      applyRemoteEvent(event);
      last = seq;
      db.prepare(`INSERT INTO sync_peers (peer_id,last_seq) VALUES (?,?) ON CONFLICT(peer_id) DO UPDATE SET last_seq=excluded.last_seq`).run(peer, last);
    }
  }
}
let syncBusy = false;
let lastSync = null;
let lastSyncError = '';
async function syncMaster() {
  if (syncBusy || !getSetting('master_root')) return;
  syncBusy = true;
  try {
    const base = await ensureMasterFolders();
    await pushLocalEvents(base);
    await pullRemoteEvents(base);
    lastSync = nowIso();
    lastSyncError = '';
  } catch (error) {
    lastSyncError = String(error?.message || error);
  } finally { syncBusy = false; }
}
async function acquireOfferLock(offerUid) {
  const base = await ensureMasterFolders();
  if (!base || !offerUid) return async () => {};
  const lockDir = path.join(base, 'locks', sanitizePeer(offerUid));
  try {
    await fsp.mkdir(lockDir);
    await fsp.writeFile(path.join(lockDir, 'owner.json'), JSON.stringify({ peerId: PEER_ID, at: nowIso() }), 'utf8');
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    let meta = null;
    try { meta = JSON.parse(await fsp.readFile(path.join(lockDir, 'owner.json'), 'utf8')); } catch {}
    const age = meta?.at ? Date.now() - new Date(meta.at).getTime() : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(age) || age > 120000) {
      await fsp.rm(lockDir, { recursive: true, force: true }).catch(() => {});
      return acquireOfferLock(offerUid);
    }
    const owner = meta?.peerId || 'un autre poste';
    throw new Error(`Cet AO est déjà en cours de modification par ${owner}.`);
  }
  return async () => { await fsp.rm(lockDir, { recursive: true, force: true }).catch(() => {}); };
}
async function moveDirectory(source, target) {
  await fsp.access(source);
  if (fs.existsSync(target)) throw Object.assign(new Error('Un dossier portant ce nom existe déjà dans la destination.'), { code: 'EEXIST' });
  try { await fsp.rename(source, target); }
  catch (error) {
    if (error?.code !== 'EXDEV') throw error;
    await fsp.cp(source, target, { recursive: true, errorOnExist: true, force: false });
    await fsp.rm(source, { recursive: true, force: true });
  }
}
async function scanStatusDirectory(root, status) {
  if (!root) return 0;
  const stat = await fsp.stat(root).catch(() => null);
  if (!stat?.isDirectory()) return 0;
  let changed = 0;
  const queue = [{ dir: root, depth: 0 }];
  const byName = new Map(db.prepare('SELECT uid, folder_name, status, final_path FROM offers').all().map((r) => [r.folder_name.toLocaleLowerCase('fr'), r]));
  while (queue.length) {
    const { dir, depth } = queue.shift();
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      const offer = byName.get(entry.name.toLocaleLowerCase('fr'));
      if (offer) {
        if (offer.status !== status || offer.final_path !== full) {
          db.prepare('UPDATE offers SET status=?, final_path=?, last_actor_pc=?, updated_at=? WHERE uid=?').run(status, full, 'SYSTEM', nowIso(), offer.uid);
          const fresh = offerByUid(offer.uid);
          queueEvent({ type:'offer.snapshot', offerUid:offer.uid, payload:{offer:serializeOffer(fresh)}, action:`Statut détecté : ${status === 'gagne' ? 'Gagné' : 'Perdu'}`, details:full, department:fresh.department, status });
          changed += 1;
        }
        continue;
      }
      if (depth < 2) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return changed;
}
let scanBusy = false;
async function scanStatuses() {
  if (scanBusy) return { changed: 0 };
  scanBusy = true;
  try {
    const won = await scanStatusDirectory(getSetting('won_path'), 'gagne');
    const lost = await scanStatusDirectory(getSetting('lost_path'), 'perdu');
    return { changed: won + lost };
  } finally { scanBusy = false; }
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, database: DB_FILE, peerId: PEER_ID }));
app.get('/api/settings', (_req, res) => res.json(publicSettings()));
app.put('/api/settings/shared', async (req, res) => {
  const masterRoot=String(req.body?.masterRoot||'').trim();
  const previousRoot=getSetting('master_root');
  const seededRoot=getSetting('master_seeded_root');

  // Capturer uniquement ce qui existait réellement sur ce poste avant de rejoindre
  // la base maître. Si la base commune existe déjà, sa configuration devient la
  // référence, mais l'historique local propre à ce poste est fusionné.
  const localOffersBefore=db.prepare('SELECT * FROM offers ORDER BY created_at,id').all().map(serializeOffer);
  const localActorsBefore=db.prepare("SELECT pc_id,display_name FROM actors WHERE display_name<>''").all();

  putSetting('master_root',masterRoot);
  putSetting('won_path',String(req.body?.wonPath||'').trim());
  putSetting('lost_path',String(req.body?.lostPath||'').trim());

  if(masterRoot&&seededRoot!==masterRoot){
    const base=await ensureMasterFolders();
    const existingMaster=await masterHasOtherPeerData(base);

    if(existingMaster){
      // Lire d'abord la référence commune : un nouveau poste vide ne doit jamais
      // écraser les destinations/arborescence du groupe.
      await pullRemoteEvents(base);
    }else{
      const configAt=nowIso();
      putSetting('shared_config_updated_at',configAt);
      putSetting('shared_config_actor',PEER_ID);
      queueEvent({type:'config.snapshot',payload:{config:sharedConfigSnapshot()},action:'Configuration locale partagée',details:'Destinations et arborescence initiales'});
    }

    for(const offer of localOffersBefore){
      queueEvent({type:'offer.snapshot',offerUid:offer.uid,payload:{offer},action:'AO existant partagé',details:offer.folderName,department:offer.department,status:offer.status});
    }
    for(const actor of localActorsBefore){
      queueEvent({type:'actor.set',payload:{pcId:actor.pc_id,displayName:actor.display_name},action:'Nom utilisateur partagé',details:`${actor.pc_id} → ${actor.display_name}`});
    }
    putSetting('master_seeded_root',masterRoot);
    await pushLocalEvents(base);
    await pullRemoteEvents(base);
    lastSync=nowIso();lastSyncError='';
  }else if(!masterRoot&&previousRoot){
    putSetting('master_seeded_root','');
  }else{
    await syncMaster();
  }

  res.json(publicSettings());
});
app.get('/api/sync/status', (_req, res) => res.json({ configured: !!getSetting('master_root'), peerId: PEER_ID, lastSync, error: lastSyncError }));
app.post('/api/sync/run', async (_req, res) => { await syncMaster(); res.json({ ok: !lastSyncError, lastSync, error: lastSyncError }); });
app.post('/api/scan-status', async (_req, res) => res.json(await scanStatuses()));

app.get('/api/actors', (_req, res) => {
  const seen = db.prepare(`SELECT pc_id FROM actors UNION SELECT created_by_pc FROM offers WHERE created_by_pc<>'' UNION SELECT last_actor_pc FROM offers WHERE last_actor_pc<>'' UNION SELECT actor_pc_id FROM activity_log WHERE actor_pc_id<>''`).all();
  for (const row of seen) if (row.pc_id) db.prepare(`INSERT INTO actors (pc_id,display_name,updated_at) VALUES (?, '', ?) ON CONFLICT(pc_id) DO NOTHING`).run(row.pc_id, nowIso());
  res.json(db.prepare('SELECT pc_id AS pcId, display_name AS displayName, updated_at AS updatedAt FROM actors ORDER BY pc_id').all());
});
app.put('/api/actors/:pcId', (req, res) => {
  const pcId = sanitizePeer(req.params.pcId);
  const displayName = String(req.body?.displayName || '').trim();
  const at = nowIso();
  db.prepare(`INSERT INTO actors (pc_id,display_name,updated_at) VALUES (?,?,?) ON CONFLICT(pc_id) DO UPDATE SET display_name=excluded.display_name,updated_at=excluded.updated_at`).run(pcId, displayName, at);
  queueEvent({ type:'actor.set', payload:{pcId, displayName}, action:'Nom utilisateur modifié', details:`${pcId} → ${displayName || pcId}` });
  res.json({ pcId, displayName });
});

app.get('/api/offers', (_req, res) => res.json(db.prepare('SELECT * FROM offers ORDER BY created_at DESC, id DESC').all().map(offerPublic)));
app.get('/api/logs', (_req, res) => {
  const rows = db.prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 5000').all().map((r) => ({
    eventId:r.event_id, offerUid:r.offer_uid, actorPcId:r.actor_pc_id, actorName:actorName(r.actor_pc_id), action:r.action,
    details:r.details, department:r.department, status:r.status, createdAt:r.created_at,
    offerTitle: r.offer_uid ? (offerByUid(r.offer_uid)?.title || '') : ''
  }));
  res.json(rows);
});

app.post('/api/offers', async (req, res) => {
  let finalPath = null;
  try {
    const destinationId = Number(req.body?.destinationId);
    const destination = db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(destinationId);
    if (!destination) throw new Error('Choisissez une destination configurée.');
    const payload = {
      date:String(req.body?.date || ''), ca:sanitizeSegment(req.body?.ca,{upper:true}), be:sanitizeSegment(req.body?.be,{upper:true}),
      client:sanitizeSegment(req.body?.client,{upper:true}), title:sanitizeSegment(req.body?.title), commercial:sanitizeSegment(req.body?.commercial,{upper:true}),
      quoteNumber:sanitizeSegment(req.body?.quoteNumber,{upper:true}), contact:String(req.body?.contact ?? ''), dueDate:String(req.body?.dueDate || ''),
      department:String(req.body?.department || '').trim()
    };
    const folderName = buildFolderName(payload);
    const tree = readTree(); assertNoDuplicateSiblings(tree);
    finalPath = await createFolderTree({ fs:fsp, basePath:destination.path, folderName, tree });
    await writeContactsFile({ fs:fsp, rootPath:finalPath, contact:payload.contact });
    const uid = crypto.randomUUID(); const at = nowIso();
    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,folderName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.id,destination.name,destination.path,finalPath,payload.department,'a_attribuer',payload.dueDate,PEER_ID,PEER_ID,at,at);
    const fresh = offerByUid(uid);
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'AO créé', details:folderName, department:fresh.department, status:fresh.status });
    await syncMaster();
    res.status(201).json(offerPublic(fresh));
  } catch (error) {
    if (finalPath) await fsp.rm(finalPath,{recursive:true,force:true}).catch(()=>{});
    const code = error?.code === 'EEXIST' ? 409 : ['EACCES','EPERM'].includes(error?.code) ? 403 : 400;
    res.status(code).json({ error:String(error?.message || error) });
  }
});

app.patch('/api/offers/:uid', (req, res) => {
  try {
    const uid = String(req.params.uid);
    const current = offerByUid(uid); if (!current) return res.status(404).json({error:'Appel d’offres introuvable.'});
    const status = req.body?.status === undefined ? current.status : normalizeStatus(req.body.status);
    const department = req.body?.department === undefined ? current.department : String(req.body.department || '').trim();
    const dueDate = req.body?.dueDate === undefined ? current.due_date : String(req.body.dueDate || '');
    const remark = req.body?.remark === undefined ? current.remark : String(req.body.remark || '').trim();
    const at = nowIso();
    db.prepare('UPDATE offers SET status=?,department=?,due_date=?,remark=?,last_actor_pc=?,updated_at=? WHERE uid=?').run(status,department,dueDate,remark,PEER_ID,at,uid);
    const fresh = offerByUid(uid);
    const changed = [];
    if (status !== current.status) changed.push(`statut ${current.status} → ${status}`);
    if (department !== current.department) changed.push(`département ${current.department || '—'} → ${department || '—'}`);
    if (dueDate !== current.due_date) changed.push(`échéance ${dueDate || '—'}`);
    if (remark !== current.remark) changed.push('remarque modifiée');
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'Suivi AO modifié', details:changed.join(' · '), department:fresh.department, status:fresh.status });
    res.json(offerPublic(fresh));
  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }
});

app.delete('/api/offers/:uid', (req, res) => {
  const uid = String(req.params.uid); const row = offerByUid(uid);
  if (!row) return res.status(404).json({error:'Appel d’offres introuvable.'});
  db.prepare('DELETE FROM offers WHERE uid=?').run(uid);
  queueEvent({ type:'offer.delete', offerUid:uid, action:'AO supprimé de l’historique', details:row.folder_name, department:row.department, status:row.status });
  res.status(204).end();
});

app.post('/api/offers/:uid/followups', (req, res) => {
  const uid = String(req.params.uid); const row = offerByUid(uid);
  if (!row) return res.status(404).json({error:'Appel d’offres introuvable.'});
  const date = String(req.body?.date || new Date().toISOString().slice(0,10));
  const note = String(req.body?.note || '').trim();
  const event = queueEvent({ type:'followup.add', offerUid:uid, payload:{date,note}, action:'Relance ajoutée', details:note, department:row.department, status:row.status });
  db.prepare('INSERT OR IGNORE INTO followups (event_id,offer_uid,followup_date,note,actor_pc_id,created_at) VALUES (?,?,?,?,?,?)').run(event.eventId,uid,date,note,PEER_ID,event.createdAt);
  db.prepare('UPDATE offers SET last_followup_at=?,followup_count=followup_count+1,last_actor_pc=?,updated_at=? WHERE uid=?').run(date,PEER_ID,event.createdAt,uid);
  res.status(201).json({ok:true});
});

app.post('/api/transfer/inspect', (req, res) => {
  const selectedPath = String(req.body?.path || '').trim();
  if (!selectedPath) return res.status(400).json({error:'Sélectionnez un dossier.'});
  const exact = db.prepare('SELECT * FROM offers WHERE lower(final_path)=lower(?)').get(selectedPath);
  if (exact) return res.json({ tracked:true, offer:offerPublic(exact), parsed:offerPublic(exact) });
  const name = path.basename(selectedPath);
  const byName = db.prepare('SELECT * FROM offers WHERE lower(folder_name)=lower(?) ORDER BY updated_at DESC LIMIT 1').get(name);
  if (byName) return res.json({ tracked:true, offer:offerPublic(byName), parsed:offerPublic(byName) });
  const parsed = parseFolderName(name);
  if (!parsed) return res.status(400).json({error:'Le nom du dossier ne correspond pas à un AO reconnu.'});
  res.json({ tracked:false, offer:null, parsed:{...parsed, folderName:name, finalPath:selectedPath, contact:'', department:'', dueDate:''} });
});

app.post('/api/transfer/execute', async (req, res) => {
  let releaseLock = async () => {};
  try {
    const sourcePath = String(req.body?.sourcePath || '').trim();
    if (!sourcePath) throw new Error('Dossier source obligatoire.');
    const destinationId = Number(req.body?.destinationId);
    const destination = db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(destinationId);
    if (!destination) throw new Error('Destination introuvable.');
    const payload = {
      date:String(req.body?.date || ''), ca:sanitizeSegment(req.body?.ca,{upper:true}), be:sanitizeSegment(req.body?.be,{upper:true}), client:sanitizeSegment(req.body?.client,{upper:true}),
      title:sanitizeSegment(req.body?.title), commercial:sanitizeSegment(req.body?.commercial,{upper:true}), quoteNumber:sanitizeSegment(req.body?.quoteNumber,{upper:true}),
      contact:String(req.body?.contact ?? ''), department:String(req.body?.department || destination.name).trim(), dueDate:String(req.body?.dueDate || '')
    };
    const newName = buildFolderName(payload);
    const targetPath = path.join(destination.path, newName);
    let uid = String(req.body?.offerUid || '').trim();
    const existing = uid ? offerByUid(uid) : db.prepare('SELECT * FROM offers WHERE lower(final_path)=lower(?) OR lower(folder_name)=lower(?) ORDER BY updated_at DESC LIMIT 1').get(sourcePath,path.basename(sourcePath));
    if (!uid && existing) uid = existing.uid;
    if (!uid) uid = crypto.randomUUID();
    releaseLock = await acquireOfferLock(uid);
    await moveDirectory(sourcePath, targetPath);
    const at = nowIso();
    if (existing) {
      db.prepare(`UPDATE offers SET folder_name=?,date_ao=?,ca=?,be=?,client=?,title=?,commercial=?,quote_number=?,contact=?,destination_id=?,destination_name=?,base_path=?,final_path=?,department=?,status='en_cours',due_date=?,last_actor_pc=?,updated_at=? WHERE uid=?`)
        .run(newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.id,destination.name,destination.path,targetPath,payload.department,payload.dueDate,PEER_ID,at,uid);
    } else {
      db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.id,destination.name,destination.path,targetPath,payload.department,'en_cours',payload.dueDate,PEER_ID,PEER_ID,at,at);
    }
    const fresh = offerByUid(uid);
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'AO transféré', details:`${sourcePath} → ${targetPath}`, department:fresh.department, status:fresh.status });
    await syncMaster();
    res.json(offerPublic(fresh));
  } catch (error) {
    const code = error?.code === 'EEXIST' ? 409 : ['EACCES','EPERM'].includes(error?.code) ? 403 : 400;
    res.status(code).json({error:String(error?.message || error)});
  } finally { await releaseLock(); }
});

app.post('/api/bootstrap/import', (req, res) => {
  try {
    const template = req.body?.template || {};
    const destinations = Array.isArray(template.destinations) ? template.destinations : [];
    const tree = normalizeTree(template.tree);
    if (!destinations.length) throw new Error('Le modèle ne contient aucune destination.');
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM destinations').run();
      const insert = db.prepare('INSERT INTO destinations (name,path) VALUES (?,?)');
      for (const d of destinations) insert.run(sanitizeSegment(d.name), cleanDestinationPath(d.path));
      putSetting('folder_tree', JSON.stringify(tree)); putSetting('bootstrap_complete','1');
    }); tx(); queueSharedConfig('Modèle de démarrage importé'); void syncMaster(); res.json(publicSettings());
  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }
});
app.post('/api/bootstrap/skip', (_req,res) => { putSetting('bootstrap_complete','1'); res.json(publicSettings()); });
app.post('/api/destinations', (req,res) => {
  try { const name=sanitizeSegment(req.body?.name), p=cleanDestinationPath(req.body?.path); if(!name) throw new Error('Nom obligatoire.'); const info=db.prepare('INSERT INTO destinations (name,path) VALUES (?,?)').run(name,p); queueSharedConfig('Destination ajoutée'); void syncMaster(); res.status(201).json(db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(info.lastInsertRowid)); }
  catch(error){res.status(String(error.message).includes('UNIQUE')?409:400).json({error:String(error.message).includes('UNIQUE')?'Ce nom de destination existe déjà.':String(error.message||error)});}
});
app.put('/api/destinations/:id',(req,res)=>{try{const id=Number(req.params.id),name=sanitizeSegment(req.body?.name),p=cleanDestinationPath(req.body?.path);const info=db.prepare('UPDATE destinations SET name=?,path=? WHERE id=?').run(name,p,id);if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});queueSharedConfig('Destination modifiée');void syncMaster();res.json(db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(id));}catch(error){res.status(400).json({error:String(error.message||error)});}});
app.delete('/api/destinations/:id',(req,res)=>{const info=db.prepare('DELETE FROM destinations WHERE id=?').run(Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});queueSharedConfig('Destination supprimée');void syncMaster();res.status(204).end();});
app.put('/api/tree',(req,res)=>{try{const tree=normalizeTree(req.body?.tree);assertNoDuplicateSiblings(tree);putSetting('folder_tree',JSON.stringify(tree));queueSharedConfig('Arborescence modifiée');void syncMaster();res.json({tree});}catch(error){res.status(400).json({error:String(error.message||error)});}});

if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.use((req,res,next)=>{ if(req.path.startsWith('/api/')) return next(); res.sendFile(path.join(DIST_DIR,'index.html')); });
}
app.use((error,_req,res,_next)=>{console.error(error);res.status(500).json({error:'Erreur interne.'});});

const server = app.listen(PORT,'127.0.0.1',()=>console.log(`API Créateur d’AO v0.4 prête sur ${PORT} (${PEER_ID}).`));
const syncTimer = setInterval(syncMaster,SYNC_INTERVAL_MS); syncTimer.unref?.();
const scanTimer = setInterval(scanStatuses,STATUS_SCAN_INTERVAL_MS); scanTimer.unref?.();
setTimeout(syncMaster,800).unref?.();
setTimeout(scanStatuses,5000).unref?.();
function close(){clearInterval(syncTimer);clearInterval(scanTimer);server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',close); process.on('SIGTERM',close);
