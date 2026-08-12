import fs from 'node:fs';

const file = 'server-v4.mjs';
let text = fs.readFileSync(file,'utf8');

text = text.replace(
  `['updated_at', "ALTER TABLE offers ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP"]`,
  `['updated_at', "ALTER TABLE offers ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"]`
);

const legacyNeedle = `for (const row of legacyRows) setLegacyUid.run(crypto.randomUUID(), row.id);\n`;
if (!text.includes('idx_offers_uid')) {
  text = text.replace(legacyNeedle, legacyNeedle + `db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_uid ON offers(uid)');\ndb.prepare("UPDATE offers SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at = '' OR updated_at IS NULL").run();\n`);
}

const oldLock = `  } catch (error) {\n    if (error?.code !== 'EEXIST') throw error;\n    let owner = 'un autre poste';\n    try { owner = JSON.parse(await fsp.readFile(path.join(lockDir, 'owner.json'), 'utf8'))?.peerId || owner; } catch {}\n    throw new Error(\`Cet AO est déjà en cours de modification par \${owner}.\`);\n  }\n`;
const newLock = `  } catch (error) {\n    if (error?.code !== 'EEXIST') throw error;\n    let meta = null;\n    try { meta = JSON.parse(await fsp.readFile(path.join(lockDir, 'owner.json'), 'utf8')); } catch {}\n    const age = meta?.at ? Date.now() - new Date(meta.at).getTime() : Number.POSITIVE_INFINITY;\n    if (!Number.isFinite(age) || age > 120000) {\n      await fsp.rm(lockDir, { recursive: true, force: true }).catch(() => {});\n      return acquireOfferLock(offerUid);\n    }\n    const owner = meta?.peerId || 'un autre poste';\n    throw new Error(\`Cet AO est déjà en cours de modification par \${owner}.\`);\n  }\n`;
if (text.includes(oldLock)) text = text.replace(oldLock,newLock);
else if (!text.includes('age > 120000')) throw new Error('Bloc de verrou v0.4 introuvable');

fs.writeFileSync(file,text);
