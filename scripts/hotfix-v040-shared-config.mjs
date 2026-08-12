import fs from 'node:fs';

const file='server-v4.mjs';
let text=fs.readFileSync(file,'utf8');

const publicSettingsNeedle=`function actorName(pcId) {\n`;
const helpers=`function sharedConfigSnapshot() {\n  return {\n    destinations: db.prepare('SELECT name, path FROM destinations ORDER BY name COLLATE NOCASE').all(),\n    tree: readTree(),\n    updatedAt: getSetting('shared_config_updated_at') || '',\n    actorPcId: getSetting('shared_config_actor') || ''\n  };\n}\nfunction configIsNewer(snapshot, actorPc='') {\n  const incomingAt=String(snapshot?.updatedAt||'');\n  const currentAt=getSetting('shared_config_updated_at');\n  if(incomingAt>currentAt)return true;\n  if(incomingAt<currentAt)return false;\n  return sanitizePeer(actorPc||snapshot?.actorPcId||'')>sanitizePeer(getSetting('shared_config_actor'));\n}\nfunction applySharedConfigSnapshot(snapshot, actorPc='') {\n  if(!snapshot||!Array.isArray(snapshot.destinations)||!Array.isArray(snapshot.tree))return false;\n  if(!configIsNewer(snapshot,actorPc))return false;\n  const normalized=snapshot.destinations.map(d=>({name:sanitizeSegment(d?.name),path:String(d?.path||'').trim()})).filter(d=>d.name&&d.path);\n  const tree=normalizeTree(snapshot.tree);\n  assertNoDuplicateSiblings(tree);\n  const tx=db.transaction(()=>{\n    const keep=new Set(normalized.map(d=>d.name.toLocaleLowerCase('fr')));\n    const existing=db.prepare('SELECT id,name FROM destinations').all();\n    const upsert=db.prepare(\`INSERT INTO destinations (name,path) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET path=excluded.path\`);\n    for(const d of normalized)upsert.run(d.name,d.path);\n    const remove=db.prepare('DELETE FROM destinations WHERE id=?');\n    for(const d of existing)if(!keep.has(d.name.toLocaleLowerCase('fr')))remove.run(d.id);\n    putSetting('folder_tree',JSON.stringify(tree));\n    putSetting('shared_config_updated_at',String(snapshot.updatedAt||nowIso()));\n    putSetting('shared_config_actor',sanitizePeer(actorPc||snapshot.actorPcId||''));\n  });\n  tx();\n  return true;\n}\nfunction queueSharedConfig(action='Configuration partagée modifiée') {\n  const at=nowIso();\n  putSetting('shared_config_updated_at',at);\n  putSetting('shared_config_actor',PEER_ID);\n  const config=sharedConfigSnapshot();\n  queueEvent({type:'config.snapshot',payload:{config},action,details:\`\${config.destinations.length} destination(s) · arborescence partagée\`});\n}\n\n`;
if(!text.includes('function sharedConfigSnapshot()')){
  if(!text.includes(publicSettingsNeedle))throw new Error('Point insertion config introuvable');
  text=text.replace(publicSettingsNeedle,helpers+publicSettingsNeedle);
}

const applyNeedle=`    if (event.type === 'actor.set') {\n`;
const applyConfig=`    if (event.type === 'config.snapshot') {\n      applySharedConfigSnapshot(payload.config, event.peerId);\n    }\n`;
if(!text.includes("event.type === 'config.snapshot'")){
  if(!text.includes(applyNeedle))throw new Error('Point apply config introuvable');
  text=text.replace(applyNeedle,applyConfig+applyNeedle);
}

const seedNeedle=`    const knownActors = db.prepare("SELECT pc_id, display_name FROM actors WHERE display_name <> ''").all();\n`;
const seedConfig=`    const configAt = nowIso();\n    putSetting('shared_config_updated_at', configAt);\n    putSetting('shared_config_actor', PEER_ID);\n    queueEvent({ type:'config.snapshot', payload:{config:sharedConfigSnapshot()}, action:'Configuration locale partagée', details:'Destinations et arborescence initiales' });\n`;
if(!text.includes("action:'Configuration locale partagée'")){
  if(!text.includes(seedNeedle))throw new Error('Point seed config introuvable');
  text=text.replace(seedNeedle,seedConfig+seedNeedle);
}

const routeReplacements=[
  [`app.post('/api/destinations', (req,res) => {\n  try { const name=sanitizeSegment(req.body?.name), p=cleanDestinationPath(req.body?.path); if(!name) throw new Error('Nom obligatoire.'); const info=db.prepare('INSERT INTO destinations (name,path) VALUES (?,?)').run(name,p); res.status(201).json(db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(info.lastInsertRowid)); }`,
   `app.post('/api/destinations', (req,res) => {\n  try { const name=sanitizeSegment(req.body?.name), p=cleanDestinationPath(req.body?.path); if(!name) throw new Error('Nom obligatoire.'); const info=db.prepare('INSERT INTO destinations (name,path) VALUES (?,?)').run(name,p); queueSharedConfig('Destination ajoutée'); void syncMaster(); res.status(201).json(db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(info.lastInsertRowid)); }`],
  [`app.put('/api/destinations/:id',(req,res)=>{try{const id=Number(req.params.id),name=sanitizeSegment(req.body?.name),p=cleanDestinationPath(req.body?.path);const info=db.prepare('UPDATE destinations SET name=?,path=? WHERE id=?').run(name,p,id);if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});res.json(db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(id));}`,
   `app.put('/api/destinations/:id',(req,res)=>{try{const id=Number(req.params.id),name=sanitizeSegment(req.body?.name),p=cleanDestinationPath(req.body?.path);const info=db.prepare('UPDATE destinations SET name=?,path=? WHERE id=?').run(name,p,id);if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});queueSharedConfig('Destination modifiée');void syncMaster();res.json(db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(id));}`],
  [`app.delete('/api/destinations/:id',(req,res)=>{const info=db.prepare('DELETE FROM destinations WHERE id=?').run(Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});res.status(204).end();});`,
   `app.delete('/api/destinations/:id',(req,res)=>{const info=db.prepare('DELETE FROM destinations WHERE id=?').run(Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});queueSharedConfig('Destination supprimée');void syncMaster();res.status(204).end();});`],
  [`app.put('/api/tree',(req,res)=>{try{const tree=normalizeTree(req.body?.tree);assertNoDuplicateSiblings(tree);putSetting('folder_tree',JSON.stringify(tree));res.json({tree});}`,
   `app.put('/api/tree',(req,res)=>{try{const tree=normalizeTree(req.body?.tree);assertNoDuplicateSiblings(tree);putSetting('folder_tree',JSON.stringify(tree));queueSharedConfig('Arborescence modifiée');void syncMaster();res.json({tree});}`]
];
for(const [a,b] of routeReplacements){if(text.includes(a))text=text.replace(a,b);else if(!text.includes(b))throw new Error('Route config introuvable: '+a.slice(0,45));}

const bootstrapNeedle=`      putSetting('folder_tree', JSON.stringify(tree)); putSetting('bootstrap_complete','1');\n`;
const bootstrapNew=`      putSetting('folder_tree', JSON.stringify(tree)); putSetting('bootstrap_complete','1');\n`;
// L'événement est créé hors transaction après import.
const bootstrapRouteEnd=`    }); tx(); res.json(publicSettings());\n  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }\n});\napp.post('/api/bootstrap/skip'`;
const bootstrapRouteNew=`    }); tx(); queueSharedConfig('Modèle de démarrage importé'); void syncMaster(); res.json(publicSettings());\n  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }\n});\napp.post('/api/bootstrap/skip'`;
if(text.includes(bootstrapRouteEnd))text=text.replace(bootstrapRouteEnd,bootstrapRouteNew);
else if(!text.includes("queueSharedConfig('Modèle de démarrage importé')"))throw new Error('Fin bootstrap import introuvable');

fs.writeFileSync(file,text);
