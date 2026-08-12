import fs from 'node:fs';

const file = 'server-v4.mjs';
let text = fs.readFileSync(file, 'utf8');

const oldLegacy = `const legacyRows = db.prepare("SELECT id FROM offers WHERE uid IS NULL OR uid = ''").all();\nconst setLegacyUid = db.prepare('UPDATE offers SET uid = ? WHERE id = ?');\nfor (const row of legacyRows) setLegacyUid.run(crypto.randomUUID(), row.id);\n`;
const newLegacy = `function legacyOfferUid(folderName) {\n  const digest = crypto.createHash('sha256').update(String(folderName || '').toLocaleLowerCase('fr')).digest('hex').slice(0, 32);\n  return \`legacy-\${digest}\`;\n}\nconst legacyRows = db.prepare("SELECT id, folder_name FROM offers WHERE uid IS NULL OR uid = ''").all();\nconst setLegacyUid = db.prepare('UPDATE offers SET uid = ? WHERE id = ?');\nfor (const row of legacyRows) setLegacyUid.run(legacyOfferUid(row.folder_name), row.id);\n`;
if (text.includes(oldLegacy)) text = text.replace(oldLegacy, newLegacy);
else if (!text.includes('function legacyOfferUid')) throw new Error('Bloc migration UID historique introuvable');

const oldSettings = `app.put('/api/settings/shared', async (req, res) => {\n  putSetting('master_root', String(req.body?.masterRoot || '').trim());\n  putSetting('won_path', String(req.body?.wonPath || '').trim());\n  putSetting('lost_path', String(req.body?.lostPath || '').trim());\n  await syncMaster();\n  res.json(publicSettings());\n});\n`;
const newSettings = `app.put('/api/settings/shared', async (req, res) => {\n  const masterRoot = String(req.body?.masterRoot || '').trim();\n  const previousRoot = getSetting('master_root');\n  putSetting('master_root', masterRoot);\n  putSetting('won_path', String(req.body?.wonPath || '').trim());\n  putSetting('lost_path', String(req.body?.lostPath || '').trim());\n\n  // Lors de la première association à une base maître, publier aussi l'historique\n  // déjà présent sur ce poste. Les anciens AO utilisent un UID déterministe dérivé\n  // du nom du dossier, afin que deux postes possédant le même historique ne créent\n  // pas deux lignes différentes dans la base commune.\n  const seededRoot = getSetting('master_seeded_root');\n  if (masterRoot && seededRoot !== masterRoot) {\n    const existingOffers = db.prepare('SELECT * FROM offers ORDER BY created_at, id').all();\n    for (const offer of existingOffers) {\n      queueEvent({\n        type: 'offer.snapshot',\n        offerUid: offer.uid,\n        payload: { offer: serializeOffer(offer) },\n        action: 'AO existant partagé',\n        details: offer.folder_name,\n        department: offer.department,\n        status: offer.status\n      });\n    }\n    const knownActors = db.prepare("SELECT pc_id, display_name FROM actors WHERE display_name <> ''").all();\n    for (const actor of knownActors) {\n      queueEvent({\n        type: 'actor.set',\n        payload: { pcId: actor.pc_id, displayName: actor.display_name },\n        action: 'Nom utilisateur partagé',\n        details: \`\${actor.pc_id} → \${actor.display_name}\`\n      });\n    }\n    putSetting('master_seeded_root', masterRoot);\n  } else if (!masterRoot && previousRoot) {\n    putSetting('master_seeded_root', '');\n  }\n\n  await syncMaster();\n  res.json(publicSettings());\n});\n`;
if (text.includes(oldSettings)) text = text.replace(oldSettings, newSettings);
else if (!text.includes("action: 'AO existant partagé'")) throw new Error('Route settings/shared introuvable');

fs.writeFileSync(file, text);

const testFile = 'tests/runtime-v4.test.mjs';
let tests = fs.readFileSync(testFile, 'utf8');
if (!tests.includes("startsWith('legacy-')")) {
  tests = tests.replace('  assert.ok(row.uid);\n', "  assert.ok(row.uid);\n  assert.equal(row.uid.startsWith('legacy-'), true);\n");
  fs.writeFileSync(testFile, tests);
}
