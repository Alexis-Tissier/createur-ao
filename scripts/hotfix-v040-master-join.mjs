import fs from 'node:fs';
const file='server-v4.mjs';
let text=fs.readFileSync(file,'utf8');

const helperPoint=`async function pushLocalEvents(base) {\n`;
const helper=`async function masterHasOtherPeerData(base) {\n  const peersRoot=path.join(base,'peers');\n  const entries=await fsp.readdir(peersRoot,{withFileTypes:true}).catch(()=>[]);\n  for(const entry of entries){\n    if(!entry.isDirectory()||sanitizePeer(entry.name)===PEER_ID)continue;\n    try{const index=JSON.parse(await fsp.readFile(path.join(peersRoot,entry.name,'index.json'),'utf8'));if(Number(index?.latest||0)>0)return true;}catch{}\n  }\n  return false;\n}\n\n`;
if(!text.includes('async function masterHasOtherPeerData')){
  if(!text.includes(helperPoint))throw new Error('Point helper master introuvable');
  text=text.replace(helperPoint,helper+helperPoint);
}

const start=text.indexOf("app.put('/api/settings/shared'");
const end=text.indexOf("app.get('/api/sync/status'",start);
if(start<0||end<0)throw new Error('Route settings/shared introuvable');

const route=`app.put('/api/settings/shared', async (req, res) => {\n  const masterRoot=String(req.body?.masterRoot||'').trim();\n  const previousRoot=getSetting('master_root');\n  const seededRoot=getSetting('master_seeded_root');\n\n  // Capturer uniquement ce qui existait réellement sur ce poste avant de rejoindre\n  // la base maître. Si la base commune existe déjà, sa configuration devient la\n  // référence, mais l'historique local propre à ce poste est fusionné.\n  const localOffersBefore=db.prepare('SELECT * FROM offers ORDER BY created_at,id').all().map(serializeOffer);\n  const localActorsBefore=db.prepare("SELECT pc_id,display_name FROM actors WHERE display_name<>''").all();\n\n  putSetting('master_root',masterRoot);\n  putSetting('won_path',String(req.body?.wonPath||'').trim());\n  putSetting('lost_path',String(req.body?.lostPath||'').trim());\n\n  if(masterRoot&&seededRoot!==masterRoot){\n    const base=await ensureMasterFolders();\n    const existingMaster=await masterHasOtherPeerData(base);\n\n    if(existingMaster){\n      // Lire d'abord la référence commune : un nouveau poste vide ne doit jamais\n      // écraser les destinations/arborescence du groupe.\n      await pullRemoteEvents(base);\n    }else{\n      const configAt=nowIso();\n      putSetting('shared_config_updated_at',configAt);\n      putSetting('shared_config_actor',PEER_ID);\n      queueEvent({type:'config.snapshot',payload:{config:sharedConfigSnapshot()},action:'Configuration locale partagée',details:'Destinations et arborescence initiales'});\n    }\n\n    for(const offer of localOffersBefore){\n      queueEvent({type:'offer.snapshot',offerUid:offer.uid,payload:{offer},action:'AO existant partagé',details:offer.folderName,department:offer.department,status:offer.status});\n    }\n    for(const actor of localActorsBefore){\n      queueEvent({type:'actor.set',payload:{pcId:actor.pc_id,displayName:actor.display_name},action:'Nom utilisateur partagé',details:\`\${actor.pc_id} → \${actor.display_name}\`});\n    }\n    putSetting('master_seeded_root',masterRoot);\n    await pushLocalEvents(base);\n    await pullRemoteEvents(base);\n    lastSync=nowIso();lastSyncError='';\n  }else if(!masterRoot&&previousRoot){\n    putSetting('master_seeded_root','');\n  }else{\n    await syncMaster();\n  }\n\n  res.json(publicSettings());\n});\n`;
text=text.slice(0,start)+route+text.slice(end);
fs.writeFileSync(file,text);
