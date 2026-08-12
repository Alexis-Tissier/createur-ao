import fs from 'node:fs';

const file = 'server-v4.mjs';
let text = fs.readFileSync(file, 'utf8');

const oldUpsert = `function upsertOfferSnapshot(snapshot, actorPc = '') {\n  if (!snapshot?.uid) return;\n  const existing = offerByUid(snapshot.uid);\n  const params = {\n`;
const newUpsert = `function shouldApplyOfferSnapshot(existing, snapshot, actorPc = '') {\n  if (!existing) return true;\n  const incomingAt = String(snapshot?.updatedAt || snapshot?.createdAt || '');\n  const currentAt = String(existing.updated_at || existing.created_at || '');\n  if (incomingAt > currentAt) return true;\n  if (incomingAt < currentAt) return false;\n  const incomingActor = sanitizePeer(actorPc || snapshot?.lastActorPc || snapshot?.createdByPc || '');\n  const currentActor = sanitizePeer(existing.last_actor_pc || existing.created_by_pc || '');\n  return incomingActor > currentActor;\n}\nfunction upsertOfferSnapshot(snapshot, actorPc = '') {\n  if (!snapshot?.uid) return false;\n  const existing = offerByUid(snapshot.uid);\n  if (!shouldApplyOfferSnapshot(existing, snapshot, actorPc)) return false;\n  const params = {\n`;
if (text.includes(oldUpsert)) text = text.replace(oldUpsert, newUpsert);
else if (!text.includes('function shouldApplyOfferSnapshot')) throw new Error('upsertOfferSnapshot introuvable');

const oldEnd = `  }\n}\nfunction applyRemoteEvent(event) {\n`;
const newEnd = `  }\n  return true;\n}\nfunction applyRemoteEvent(event) {\n`;
const upsertIndex = text.indexOf('function upsertOfferSnapshot');
const applyIndex = text.indexOf('function applyRemoteEvent', upsertIndex);
if (upsertIndex < 0 || applyIndex < 0) throw new Error('Bornes upsert/apply introuvables');
const segment = text.slice(upsertIndex, applyIndex + 'function applyRemoteEvent'.length);
if (!segment.includes('return true;\n}\nfunction applyRemoteEvent')) {
  const before = text.slice(0, applyIndex);
  const pos = before.lastIndexOf('  }\n}\n');
  if (pos < upsertIndex) throw new Error('Fin upsert introuvable');
  text = text.slice(0, pos) + '  }\n  return true;\n}\n' + text.slice(pos + 6);
}

const oldActor = `    if (event.type === 'actor.set') {\n      db.prepare(\`INSERT INTO actors (pc_id, display_name, updated_at) VALUES (?, ?, ?)\n        ON CONFLICT(pc_id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at\`)\n        .run(payload.pcId, payload.displayName || '', event.createdAt);\n    }\n`;
const newActor = `    if (event.type === 'actor.set') {\n      db.prepare(\`INSERT INTO actors (pc_id, display_name, updated_at) VALUES (?, ?, ?)\n        ON CONFLICT(pc_id) DO UPDATE SET display_name=excluded.display_name, updated_at=excluded.updated_at\n        WHERE excluded.updated_at > actors.updated_at\n           OR (excluded.updated_at = actors.updated_at AND excluded.display_name > actors.display_name)\`)\n        .run(payload.pcId, payload.displayName || '', event.createdAt);\n    }\n`;
if (text.includes(oldActor)) text = text.replace(oldActor, newActor);
else if (!text.includes('WHERE excluded.updated_at > actors.updated_at')) throw new Error('actor.set introuvable');

fs.writeFileSync(file, text);
