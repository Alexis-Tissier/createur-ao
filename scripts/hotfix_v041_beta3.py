from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"motif introuvable: {label}")
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    a = text.find(start)
    if a < 0:
        raise SystemExit(f"début introuvable: {label}")
    b = text.find(end, a)
    if b < 0:
        raise SystemExit(f"fin introuvable: {label}")
    return text[:a] + replacement + text[b:]


# ---------------------------------------------------------------------------
# React UI
# ---------------------------------------------------------------------------
app_path = ROOT / 'src' / 'AppV4.jsx'
s = app_path.read_text(encoding='utf-8')

s = replace_once(
    s,
    "  contact: '', destinationId: ''\n});",
    "  contact: '', price: '', destinationId: ''\n});",
    'emptyOffer price'
)
s = replace_once(
    s,
    "  contact: '', destinationId: ''\n});",
    "  contact: '', price: '', destinationId: ''\n});",
    'emptyTransfer price'
)

s = replace_once(
    s,
    "        title:p.title || '', commercial:p.commercial || '', quoteNumber:p.quoteNumber || '', contact:p.contact || '', destinationId:''",
    "        title:p.title || '', commercial:p.commercial || '', quoteNumber:p.quoteNumber || '', contact:p.contact || '', price:p.price || '', destinationId:''",
    'transfer inspect price'
)

create_contact = '''        <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="Nom, mail, téléphone…"/></Field>'''
create_contact_price = create_contact + '''\n        <Field label="Prix · facultatif"><input value={form.price} onChange={e=>update('price',e.target.value)} placeholder="Ex. 125 000 €"/></Field>'''
s = replace_once(s, create_contact, create_contact_price, 'create price field')

transfer_contact = '''          <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)}/></Field>'''
transfer_contact_price = transfer_contact + '''\n          <Field label="Prix · facultatif"><input value={form.price} onChange={e=>update('price',e.target.value)} placeholder="Ex. 125 000 €"/></Field>'''
s = replace_once(s, transfer_contact, transfer_contact_price, 'transfer price field')

tracking_block = r'''function PriceCellV4({row,reload,toast}){
  const [value,setValue]=useState(row.price||'');const [busy,setBusy]=useState(false);
  useEffect(()=>setValue(row.price||''),[row.uid,row.price]);
  async function save(){
    const next=String(value||'').trim();
    if(next===String(row.price||'').trim())return;
    try{setBusy(true);await api(`/api/offers/${row.uid}`,{method:'PATCH',body:JSON.stringify({price:next})});await reload();toast({message:'Prix enregistré.'});}
    catch(error){setValue(row.price||'');toast({type:'error',message:error.message});}
    finally{setBusy(false);}
  }
  return <input className="v4-price-input" value={value} disabled={busy} onChange={e=>setValue(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} placeholder="—" title="Le montant est aussi écrit dans PRIX.txt"/>;
}

function TrackingRowV4({row,followup,reload,toast}){
  return <div className="v4-track-row">
    <div className="offer-cell"><strong>{row.title}</strong><code>{row.folderName}</code></div>
    <div className="muted-cell">{row.client||row.be||'—'}<small>{row.client&&row.be?`BE : ${row.be}`:''}</small></div>
    <ContactCellV4 value={row.contact}/>
    <PriceCellV4 row={row} reload={reload} toast={toast}/>
    <div className="destination-chip">{row.destinationName||'Création'}</div>
    <div className={`status-badge ${row.status}`}>{STATUS[row.status]||row.status}</div>
    <div className="v4-date-cell">{row.date ? new Date(`${row.date}T12:00:00`).toLocaleDateString('fr-FR') : '—'}</div>
    <div className="v4-track-actions"><div className="muted-cell"><strong>{row.lastActorName||row.lastActorPc||'—'}</strong><small>{row.updatedAt?new Date(row.updatedAt).toLocaleString('fr-FR'):''}</small></div><button type="button" className="small-action" onClick={followup}>Relance</button><small>{row.lastFollowupAt?`${row.lastFollowupAt} · ${row.followupCount}`:'Aucune relance'}</small></div>
  </div>;
}

function TrackingPage({ offers, reload, toast }) {
  const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);
  const rows=useMemo(()=>offers.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');const okQ=!q||[r.folderName,r.title,r.client,r.be,r.ca,r.contact,r.price,r.destinationName,r.createdByName,r.lastActorName].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q));return okQ&&(!status||r.status===status)&&(!destination||r.destinationName===destination);}),[offers,query,status,destination]);
  const destinations=[...new Set(offers.map(x=>x.destinationName).filter(Boolean))].sort();
  async function scan(){
    try{
      const r=await api('/api/scan-status',{method:'POST'});await reload();
      if(r.missing)toast({message:`${r.missing} dossier(s) introuvable(s) détecté(s).`});
      else if(r.changed)toast({message:`${r.changed} changement(s) détecté(s)${r.prices?` · ${r.prices} prix mis à jour`:''}.`});
      else toast({message:'Aucun changement détecté.'});
    }catch(error){toast({type:'error',message:error.message});}
  }
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Pilotage</span><h1>Suivi des AO</h1></div><button type="button" className="secondary-button" onClick={scan}><Icon name="refresh" size={15}/>Scanner les emplacements</button></header><div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Toutes les destinations</option>{destinations.map(d=><option key={d}>{d}</option>)}</select></div><section className="v4-table-card"><div className="v4-track-row head"><span>AO</span><span>Client / BE</span><span>Contact</span><span>Prix</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Suivi</span></div>{!rows.length?<div className="empty-state"><strong>Aucun AO</strong></div>:rows.map(row=><TrackingRowV4 key={row.uid} row={row} reload={reload} toast={toast} followup={()=>setFollowup(row)}/>)}</section>{followup&&<FollowupModalV4 row={followup} close={()=>setFollowup(null)} reload={reload} toast={toast}/>}</main>;
}

'''
s = replace_between(s, 'function TrackingRowV4(', 'function LogsPage(', tracking_block, 'tracking price')

# Remove the legacy/version sentence from the tree panel.
s = s.replace('<p className="tree-help">Cette fonction v0.3 est conservée : les sous-dossiers configurés sont créés avec chaque nouvel AO.</p>', '')

app_path.write_text(s, encoding='utf-8')


# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------
css_path = ROOT / 'src' / 'styles-v4.css'
css = css_path.read_text(encoding='utf-8')
css += r'''

/* beta3-price-and-alignment */
.new-line{grid-template-columns:minmax(130px,180px) minmax(280px,1fr) 38px 38px}
.new-line .add-destination{grid-column:3/5;width:100%;min-height:42px;margin:0}
.v4-track-row{grid-template-columns:minmax(200px,1.32fr) minmax(105px,.68fr) minmax(130px,.82fr) 112px minmax(100px,.64fr) 94px 96px minmax(150px,.92fr)}
.v4-price-input{width:100%;min-width:0;height:36px!important;padding:0 9px!important;text-align:right;font-size:12px!important;font-variant-numeric:tabular-nums}
.v4-price-input:disabled{opacity:.65}
@media(max-width:1250px){.v4-track-row{min-width:1180px}}
'''
css_path.write_text(css, encoding='utf-8')


# ---------------------------------------------------------------------------
# Backend / DB / filesystem
# ---------------------------------------------------------------------------
server_path = ROOT / 'server-v4.mjs'
s = server_path.read_text(encoding='utf-8')

s = replace_once(s,
    "    contact TEXT NOT NULL DEFAULT '',\n    destination_id INTEGER,",
    "    contact TEXT NOT NULL DEFAULT '',\n    price TEXT NOT NULL DEFAULT '',\n    destination_id INTEGER,",
    'price schema')

s = replace_once(s,
    "  ['client', \"ALTER TABLE offers ADD COLUMN client TEXT NOT NULL DEFAULT ''\"],\n  ['department',",
    "  ['client', \"ALTER TABLE offers ADD COLUMN client TEXT NOT NULL DEFAULT ''\"],\n  ['price', \"ALTER TABLE offers ADD COLUMN price TEXT NOT NULL DEFAULT ''\"],\n  ['department',",
    'price migration')

s = replace_once(s,
    "    contact: row.contact,\n    destinationId:",
    "    contact: row.contact,\n    price: row.price || '',\n    destinationId:",
    'price public')

s = replace_once(s,
    "    title: snapshot.title || '', commercial: snapshot.commercial || '', quoteNumber: snapshot.quoteNumber || '', contact: snapshot.contact || '',\n    destinationId:",
    "    title: snapshot.title || '', commercial: snapshot.commercial || '', quoteNumber: snapshot.quoteNumber || '', contact: snapshot.contact || '', price: snapshot.price || '',\n    destinationId:",
    'price snapshot params')

s = replace_once(s,
    "      quote_number=@quoteNumber,contact=@contact,destination_id=@destinationId,destination_name=@destinationName,base_path=@basePath,final_path=@finalPath,",
    "      quote_number=@quoteNumber,contact=@contact,price=@price,destination_id=@destinationId,destination_name=@destinationName,base_path=@basePath,final_path=@finalPath,",
    'price snapshot update')

s = replace_once(s,
    "    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,\n      department,status,due_date,remark,created_by_pc,last_actor_pc,last_followup_at,followup_count,created_at,updated_at)\n      VALUES (@uid,@folderName,@date,@ca,@be,@client,@title,@commercial,@quoteNumber,@contact,@destinationId,@destinationName,@basePath,@finalPath,\n      @department,@status,@dueDate,@remark,@createdByPc,@lastActorPc,@lastFollowupAt,@followupCount,@createdAt,@updatedAt)`).run(params);",
    "    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,price,destination_id,destination_name,base_path,final_path,\n      department,status,due_date,remark,created_by_pc,last_actor_pc,last_followup_at,followup_count,created_at,updated_at)\n      VALUES (@uid,@folderName,@date,@ca,@be,@client,@title,@commercial,@quoteNumber,@contact,@price,@destinationId,@destinationName,@basePath,@finalPath,\n      @department,@status,@dueDate,@remark,@createdByPc,@lastActorPc,@lastFollowupAt,@followupCount,@createdAt,@updatedAt)`).run(params);",
    'price snapshot insert')

helper_anchor = '''function normalizeStatus(value) {
  const status = String(value || 'a_attribuer');
  return STATUS_VALUES.has(status) ? status : 'a_attribuer';
}
'''
helpers = r'''function normalizePrice(value) { return String(value ?? '').trim(); }
async function readOptionalTextFile(file) {
  try { return { exists:true, value:(await fsp.readFile(file, 'utf8')).trim() }; }
  catch (error) { if (error?.code === 'ENOENT') return { exists:false, value:'' }; throw error; }
}
async function readPriceFile(rootPath) { return readOptionalTextFile(path.join(rootPath, 'PRIX.txt')); }
async function writePriceFile(rootPath, value) { await fsp.writeFile(path.join(rootPath, 'PRIX.txt'), normalizePrice(value), 'utf8'); }
async function readContactFile(rootPath) { return readOptionalTextFile(path.join(rootPath, 'CONTACTS.txt')); }

''' + helper_anchor
s = replace_once(s, helper_anchor, helpers, 'price helpers')

# Creation payload + PRIX.txt + DB column.
s = replace_once(s,
    "      quoteNumber:sanitizeSegment(req.body?.quoteNumber,{upper:true}), contact:String(req.body?.contact ?? '')\n    };",
    "      quoteNumber:sanitizeSegment(req.body?.quoteNumber,{upper:true}), contact:String(req.body?.contact ?? ''), price:normalizePrice(req.body?.price)\n    };",
    'create payload price')

s = replace_once(s,
    "    await writeContactsFile({ fs:fsp, rootPath:finalPath, contact:payload.contact });\n    const uid = crypto.randomUUID();",
    "    await writeContactsFile({ fs:fsp, rootPath:finalPath, contact:payload.contact });\n    await writePriceFile(finalPath, payload.price);\n    const uid = crypto.randomUUID();",
    'create PRIX')

s = replace_once(s,
    "    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)\n      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,folderName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.id,destination.name,destination.path,finalPath,'','a_attribuer',payload.date,PEER_ID,PEER_ID,at,at);",
    "    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,price,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)\n      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,folderName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,payload.price,destination.id,destination.name,destination.path,finalPath,'','a_attribuer',payload.date,PEER_ID,PEER_ID,at,at);",
    'create insert price')

patch_block = r'''app.patch('/api/offers/:uid', async (req, res) => {
  try {
    const uid = String(req.params.uid);
    const current = offerByUid(uid); if (!current) return res.status(404).json({error:'Appel d’offres introuvable.'});
    const remark = req.body?.remark === undefined ? current.remark : String(req.body.remark || '').trim();
    const price = req.body?.price === undefined ? String(current.price || '') : normalizePrice(req.body.price);
    const priceChanged = price !== String(current.price || '');
    if (priceChanged && current.final_path) {
      const stat = await fsp.stat(current.final_path).catch(() => null);
      if (stat?.isDirectory()) await writePriceFile(current.final_path, price);
    }
    const at = nowIso();
    db.prepare("UPDATE offers SET due_date=date_ao,department='',remark=?,price=?,last_actor_pc=?,updated_at=? WHERE uid=?").run(remark,price,PEER_ID,at,uid);
    const fresh = offerByUid(uid);
    const changes=[];
    if(remark!==current.remark)changes.push('remarque modifiée');
    if(priceChanged)changes.push(`prix : ${price || 'vide'}`);
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'Suivi AO modifié', details:changes.join(' · '), status:fresh.status });
    res.json(offerPublic(fresh));
  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }
});

'''
s = replace_between(s, "app.patch('/api/offers/:uid'", "app.delete('/api/offers/:uid'", patch_block, 'patch price')

inspect_block = r'''app.post('/api/transfer/inspect', async (req, res) => {
  try {
    const selectedPath = String(req.body?.path || '').trim();
    if (!selectedPath) return res.status(400).json({error:'Sélectionnez un dossier.'});
    const diskPrice = await readPriceFile(selectedPath);
    const diskContact = await readContactFile(selectedPath);
    const exact = db.prepare('SELECT * FROM offers WHERE lower(final_path)=lower(?)').get(selectedPath);
    if (exact) {
      const value=offerPublic(exact); if(diskPrice.exists)value.price=diskPrice.value; if(diskContact.exists&&diskContact.value)value.contact=diskContact.value;
      return res.json({ tracked:true, offer:value, parsed:value });
    }
    const name = path.basename(selectedPath);
    const byName = db.prepare('SELECT * FROM offers WHERE lower(folder_name)=lower(?) ORDER BY updated_at DESC LIMIT 1').get(name);
    if (byName) {
      const value=offerPublic(byName); if(diskPrice.exists)value.price=diskPrice.value; if(diskContact.exists&&diskContact.value)value.contact=diskContact.value;
      return res.json({ tracked:true, offer:value, parsed:value });
    }
    const parsed = parseFolderName(name);
    if (!parsed) return res.status(400).json({error:'Le nom du dossier ne correspond pas à un AO reconnu.'});
    res.json({ tracked:false, offer:null, parsed:{...parsed, folderName:name, finalPath:selectedPath, contact:diskContact.value || '', price:diskPrice.value || '', dueDate:parsed.date || ''} });
  } catch(error) { res.status(400).json({error:String(error?.message || error)}); }
});

'''
s = replace_between(s, "app.post('/api/transfer/inspect'", "app.post('/api/transfer/execute'", inspect_block, 'inspect price')

# Transfer payload: this is the second payload occurrence after the creation block.
needle = "      contact:String(req.body?.contact ?? '')\n    };\n    const newName = buildFolderName(payload);"
replacement = "      contact:String(req.body?.contact ?? ''), price:normalizePrice(req.body?.price)\n    };\n    const newName = buildFolderName(payload);"
s = replace_once(s, needle, replacement, 'transfer payload price')

s = replace_once(s,
    "    await moveDirectory(sourcePath, targetPath);\n    const at = nowIso();",
    "    await moveDirectory(sourcePath, targetPath);\n    await writePriceFile(targetPath, payload.price);\n    const at = nowIso();",
    'transfer PRIX')

s = replace_once(s,
    "      db.prepare(`UPDATE offers SET folder_name=?,date_ao=?,ca=?,be=?,client=?,title=?,commercial=?,quote_number=?,contact=?,destination_id=NULL,destination_name=?,base_path=?,final_path=?,department='',status='en_cours',due_date=?,last_actor_pc=?,updated_at=? WHERE uid=?`)\n        .run(newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.name,destination.path,targetPath,payload.date,PEER_ID,at,uid);",
    "      db.prepare(`UPDATE offers SET folder_name=?,date_ao=?,ca=?,be=?,client=?,title=?,commercial=?,quote_number=?,contact=?,price=?,destination_id=NULL,destination_name=?,base_path=?,final_path=?,department='',status='en_cours',due_date=?,last_actor_pc=?,updated_at=? WHERE uid=?`)\n        .run(newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,payload.price,destination.name,destination.path,targetPath,payload.date,PEER_ID,at,uid);",
    'transfer update price')

s = replace_once(s,
    "      db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,null,destination.name,destination.path,targetPath,'','en_cours',payload.date,PEER_ID,PEER_ID,at,at);",
    "      db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,price,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,payload.price,null,destination.name,destination.path,targetPath,'','en_cours',payload.date,PEER_ID,PEER_ID,at,at);",
    'transfer insert price')

# Stronger missing detection: the parent of the recorded AO path is enough proof that the path is online.
s = replace_once(s,
    "    const baseStat = row.base_path ? await fsp.stat(row.base_path).catch(() => null) : null;\n    if (!baseStat?.isDirectory()) continue; // chemin réseau indisponible : ne pas conclure à une suppression",
    "    const parentStat = await fsp.stat(path.dirname(row.final_path)).catch(() => null);\n    const baseStat = row.base_path ? await fsp.stat(row.base_path).catch(() => null) : null;\n    if (!parentStat?.isDirectory() && !baseStat?.isDirectory()) continue; // partage indisponible : ne pas conclure à une suppression",
    'missing parent probe')

scan_block = r'''async function syncPricesFromDisk() {
  let changed=0;
  const rows=db.prepare('SELECT uid,price,final_path,status FROM offers').all();
  for(const row of rows){
    if(!row.final_path)continue;
    const stat=await fsp.stat(row.final_path).catch(()=>null);
    if(!stat?.isDirectory())continue;
    const disk=await readPriceFile(row.final_path);
    if(!disk.exists){
      if(String(row.price||'').trim()) await writePriceFile(row.final_path,row.price).catch(()=>{});
      continue;
    }
    if(disk.value===String(row.price||'').trim())continue;
    const at=nowIso();
    db.prepare('UPDATE offers SET price=?,last_actor_pc=?,updated_at=? WHERE uid=?').run(disk.value,'SYSTEM',at,row.uid);
    const fresh=offerByUid(row.uid);
    queueEvent({type:'offer.snapshot',offerUid:row.uid,payload:{offer:serializeOffer(fresh)},action:'Prix détecté dans PRIX.txt',details:disk.value||'vide',status:fresh.status});
    changed+=1;
  }
  return changed;
}
async function scanStatuses() {
  if (scanBusy) return { changed: 0, missing: 0, prices: 0 };
  scanBusy = true;
  try {
    let changed = 0;
    const destinations = db.prepare('SELECT id,name,path FROM transfer_destinations ORDER BY name COLLATE NOCASE').all();
    const stages = [[2,'en_cours'],[3,'envoye'],[4,'gagne'],[5,'perdu']];
    for (const destination of destinations) {
      for (const [number,status] of stages) {
        const stageRoot = await findNumberedChild(destination.path, number);
        if (stageRoot) changed += await scanStageDirectory(stageRoot, status, destination);
      }
    }
    const missing = await markMissingOffers();
    const prices = await syncPricesFromDisk();
    changed += missing + prices;
    return { changed, missing, prices };
  } finally { scanBusy = false; }
}

'''
s = replace_between(s, 'async function scanStatuses()', 'function localDateKey(', scan_block, 'scan result + prices')

server_path.write_text(s, encoding='utf-8')


# ---------------------------------------------------------------------------
# Electron native folder picker: default to the AO share.
# ---------------------------------------------------------------------------
main_path = ROOT / 'desktop' / 'main.cjs'
s = main_path.read_text(encoding='utf-8')
s = replace_once(s,
    "const PROD_PORT = 4178;\nlet mainWindow",
    "const PROD_PORT = 4178;\nconst DEFAULT_BROWSE_PATH = '\\\\sie15\\Travaux\\2 APPELS D OFFRES';\nlet mainWindow",
    'default AO browse path')
s = replace_once(s,
    "  const safeInitialPath = typeof initialPath === 'string' && initialPath.trim() ? initialPath.trim() : undefined;",
    "  const requestedPath = typeof initialPath === 'string' && initialPath.trim() ? initialPath.trim() : '';\n  const safeInitialPath = requestedPath || (fs.existsSync(DEFAULT_BROWSE_PATH) ? DEFAULT_BROWSE_PATH : undefined);",
    'folder dialog default')
main_path.write_text(s, encoding='utf-8')


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
test_path = ROOT / 'tests' / 'workflow-v4.test.mjs'
s = test_path.read_text(encoding='utf-8')
s = replace_once(s,
    "title:'Test',commercial:'',quoteNumber:'',contact:'',destinationId:creation.id",
    "title:'Test',commercial:'',quoteNumber:'',contact:'contact@test.fr',price:'12 500 €',destinationId:creation.id",
    'test create price')
s = replace_once(s,
    "    assert.equal(offer.folderName.endsWith('Test__'),true);",
    "    assert.equal(offer.folderName.endsWith('Test__'),true);\n    assert.equal(offer.price,'12 500 €');\n    assert.equal((await fs.readFile(path.join(offer.finalPath,'PRIX.txt'),'utf8')).trim(),'12 500 €');",
    'test PRIX creation')
s = replace_once(s,
    "    assert.equal(after4.status,'gagne');\n    await fs.rm(target4,{recursive:true,force:true});",
    "    assert.equal(after4.status,'gagne');\n    await fs.writeFile(path.join(target4,'PRIX.txt'),'13 250 €','utf8');\n    const priceScan=await json(base+'/api/scan-status',{method:'POST'});\n    assert.equal(priceScan.prices,1);\n    const repriced=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);\n    assert.equal(repriced.price,'13 250 €');\n    await json(base+`/api/offers/${offer.uid}`,{method:'PATCH',body:JSON.stringify({price:'14 000 €'})});\n    assert.equal((await fs.readFile(path.join(target4,'PRIX.txt'),'utf8')).trim(),'14 000 €');\n    await fs.rm(target4,{recursive:true,force:true});",
    'test price scan')
s = replace_once(s,
    "    assert.equal(missing.status,'introuvable');\n    const backup=await json(base+'/api/backups',{method:'POST'});",
    "    assert.equal(missing.status,'introuvable');\n    const orphan=await json(base+'/api/offers',{method:'POST',body:JSON.stringify({date:'2026-08-13',ca:'XX',be:'BET2',client:'',title:'Suppression creation',commercial:'',quoteNumber:'',contact:'',price:'',destinationId:creation.id})});\n    assert.equal(await fs.readFile(path.join(orphan.finalPath,'PRIX.txt'),'utf8'),'');\n    await fs.rm(orphan.finalPath,{recursive:true,force:true});\n    const missingCreationScan=await json(base+'/api/scan-status',{method:'POST'});\n    assert.ok(missingCreationScan.missing>=1);\n    const missingCreation=(await json(base+'/api/offers')).find(x=>x.uid===orphan.uid);\n    assert.equal(missingCreation.status,'introuvable');\n    const backup=await json(base+'/api/backups',{method:'POST'});",
    'test creation missing')
test_path.write_text(s, encoding='utf-8')


# ---------------------------------------------------------------------------
# Version / changelog
# ---------------------------------------------------------------------------
package_path = ROOT / 'package.json'
pkg = json.loads(package_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.3'
package_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

lock_path = ROOT / 'package-lock.json'
lock = json.loads(lock_path.read_text(encoding='utf-8'))
lock['version'] = lock.get('version')
if isinstance(lock.get('packages'), dict) and '' in lock['packages']:
    lock['packages']['']['version'] = '0.4.1-beta.3'
# package-lock's top-level package version is stored in packages[""]; keep no invented field.
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

change_path = ROOT / 'CHANGELOG.md'
ch = change_path.read_text(encoding='utf-8')
section = '''## v0.4.1-beta.3\n\n- les sélecteurs de dossiers s’ouvrent par défaut sur `\\\\sie15\\Travaux\\2 APPELS D OFFRES` lorsqu’aucun chemin courant n’est renseigné ;\n- ajout du prix dans le suivi, modifiable directement depuis la colonne Prix ;\n- création automatique de `PRIX.txt` dans chaque nouvel AO, vide ou prérempli selon le montant saisi ;\n- lecture de `PRIX.txt` lors d’un transfert et lors du scan des emplacements ; une modification manuelle du fichier remonte dans le suivi ;\n- modification du prix depuis le suivi réécrit également `PRIX.txt` ;\n- détection `Introuvable` renforcée en contrôlant aussi le dossier parent de l’ancien emplacement, afin de distinguer un AO supprimé d’un partage réseau indisponible ;\n- correction de l’alignement du bouton Ajouter dans les destinations ;\n- suppression du texte de compatibilité v0.3 dans l’arborescence.\n\n'''
if '## v0.4.1-beta.3' not in ch:
    if ch.startswith('# Changelog\n'):
        ch = '# Changelog\n\n' + section + ch[len('# Changelog\n'):].lstrip('\n')
    else:
        ch = section + ch
change_path.write_text(ch, encoding='utf-8')

print('v0.4.1-beta.3 hotfix applied')
