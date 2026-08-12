import fs from 'node:fs';

const file = 'server-v4.mjs';
let text = fs.readFileSync(file,'utf8');

const offerMigrations = `for (const [column, sql] of [\n  ['uid', \"ALTER TABLE offers ADD COLUMN uid TEXT\"],\n  ['client', \"ALTER TABLE offers ADD COLUMN client TEXT NOT NULL DEFAULT ''\"],\n  ['department', \"ALTER TABLE offers ADD COLUMN department TEXT NOT NULL DEFAULT ''\"],\n  ['status', \"ALTER TABLE offers ADD COLUMN status TEXT NOT NULL DEFAULT 'a_attribuer'\"],\n  ['due_date', \"ALTER TABLE offers ADD COLUMN due_date TEXT NOT NULL DEFAULT ''\"],\n  ['created_by_pc', \"ALTER TABLE offers ADD COLUMN created_by_pc TEXT NOT NULL DEFAULT ''\"],\n  ['last_actor_pc', \"ALTER TABLE offers ADD COLUMN last_actor_pc TEXT NOT NULL DEFAULT ''\"],\n  ['updated_at', \"ALTER TABLE offers ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''\"]\n]) ensureColumn('offers', column, sql);\n`;

const followupMigration = `${offerMigrations}\nfor (const [column, sql] of [\n  ['event_id', \"ALTER TABLE followups ADD COLUMN event_id TEXT\"],\n  ['offer_uid', \"ALTER TABLE followups ADD COLUMN offer_uid TEXT NOT NULL DEFAULT ''\"],\n  ['actor_pc_id', \"ALTER TABLE followups ADD COLUMN actor_pc_id TEXT NOT NULL DEFAULT ''\"]\n]) ensureColumn('followups', column, sql);\n`;

if (!text.includes("ensureColumn('followups'")) {
  if (!text.includes(offerMigrations)) throw new Error('Migrations offers introuvables');
  text = text.replace(offerMigrations, followupMigration);
}

const uidNeedle = `db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_uid ON offers(uid)');\ndb.prepare(\"UPDATE offers SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at = '' OR updated_at IS NULL\").run();\n`;
const followupBackfill = `${uidNeedle}db.prepare(\"UPDATE followups SET offer_uid = COALESCE((SELECT uid FROM offers WHERE offers.id = followups.offer_id), offer_uid) WHERE offer_uid = '' AND EXISTS (SELECT 1 FROM pragma_table_info('followups') WHERE name='offer_id')\").run();\ndb.prepare(\"UPDATE followups SET event_id = 'legacy-followup-' || id WHERE event_id IS NULL OR event_id = ''\").run();\ndb.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_followups_event_id ON followups(event_id)');\n`;
if (!text.includes('idx_followups_event_id')) {
  if (!text.includes(uidNeedle)) throw new Error('Backfill UID introuvable');
  text = text.replace(uidNeedle, followupBackfill);
}

fs.writeFileSync(file,text);

const testFile = 'tests/runtime-v4.test.mjs';
let testText = fs.readFileSync(testFile,'utf8');
if (!testText.includes("/followups`")) {
  const healthNeedle = `    assert.equal(health.peerId, 'ATISSIER-TEST');\n`;
  const addition = `${healthNeedle}    const offers = await fetch(\`http://127.0.0.1:\${port}/api/offers\`).then((r) => r.json());\n    assert.equal(offers.length, 1);\n    const followupResponse = await fetch(\`http://127.0.0.1:\${port}/api/offers/\${offers[0].uid}/followups\`, {\n      method: 'POST',\n      headers: { 'Content-Type': 'application/json' },\n      body: JSON.stringify({ date: '2026-08-12', note: 'Migration OK' })\n    });\n    assert.equal(followupResponse.status, 201);\n`;
  if (!testText.includes(healthNeedle)) throw new Error('Point test health introuvable');
  testText = testText.replace(healthNeedle, addition);
  fs.writeFileSync(testFile,testText);
}
