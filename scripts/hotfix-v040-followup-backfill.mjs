import fs from 'node:fs';
const file='server-v4.mjs';
let text=fs.readFileSync(file,'utf8');
const old=`db.prepare("UPDATE followups SET offer_uid = COALESCE((SELECT uid FROM offers WHERE offers.id = followups.offer_id), offer_uid) WHERE offer_uid = '' AND EXISTS (SELECT 1 FROM pragma_table_info('followups') WHERE name='offer_id')").run();\ndb.prepare("UPDATE followups SET event_id = 'legacy-followup-' || id WHERE event_id IS NULL OR event_id = ''").run();\n`;
const replacement=`const followupColumns = new Set(db.prepare('PRAGMA table_info(followups)').all().map((row) => row.name));\nif (followupColumns.has('offer_id')) {\n  db.prepare("UPDATE followups SET offer_uid = COALESCE((SELECT uid FROM offers WHERE offers.id = followups.offer_id), offer_uid) WHERE offer_uid = ''").run();\n}\ndb.prepare("UPDATE followups SET event_id = 'legacy-followup-' || id WHERE event_id IS NULL OR event_id = ''").run();\n`;
if(text.includes(old))text=text.replace(old,replacement);
else if(!text.includes("followupColumns.has('offer_id')"))throw new Error('Backfill followups introuvable');
fs.writeFileSync(file,text);
