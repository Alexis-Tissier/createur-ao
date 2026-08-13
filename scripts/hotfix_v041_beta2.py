from pathlib import Path
import json

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


# ---- React UI ------------------------------------------------------------
app_path = ROOT / 'src' / 'AppV4.jsx'
s = app_path.read_text(encoding='utf-8')

s = replace_once(
    s,
    "  gagne: 'Gagné',\n  perdu: 'Perdu'\n};",
    "  gagne: 'Gagné',\n  perdu: 'Perdu',\n  introuvable: 'Introuvable'\n};",
    'status introuvable'
)

preview_marker = """function preview(form) {
  const [y='AAAA',m='MM',d='JJ'] = String(form.date || '').split('-');
  return [y||'AAAA',m||'MM',d||'JJ',clean(form.ca)||'XX',clean(form.be)||'XX',clean(form.client)||'XX',clean(form.title)||'INTITULE',clean(form.commercial),clean(form.quoteNumber)].join('_');
}
"""
contact_helpers = preview_marker + """function contactHref(value) {
  const text=String(value||'').trim();
  if(!text)return '';
  const url=text.match(/https?:\\/\\/[^\\s,;]+|www\\.[^\\s,;]+/i)?.[0];
  if(url)return /^https?:\\/\\//i.test(url)?url:`https://${url}`;
  const email=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i)?.[0];
  return email?`mailto:${email}`:'';
}
function ContactCellV4({value}){
  const text=String(value||'').trim();
  if(!text)return <span className=\"muted-cell\">—</span>;
  const href=contactHref(text);
  return href?<a className=\"v4-contact-link\" href={href} target=\"_blank\" rel=\"noreferrer\" title={text}>{text}</a>:<span className=\"v4-contact-text\" title={text}>{text}</span>;
}
"""
s = replace_once(s, preview_marker, contact_helpers, 'contact helpers')

tracking_block = """function TrackingRowV4({row,followup}){
  return <div className=\"v4-track-row\">
    <div className=\"offer-cell\"><strong>{row.title}</strong><code>{row.folderName}</code></div>
    <div className=\"muted-cell\">{row.client||row.be||'—'}<small>{row.client&&row.be?`BE : ${row.be}`:''}</small></div>
    <ContactCellV4 value={row.contact}/>
    <div className=\"destination-chip\">{row.destinationName||'Création'}</div>
    <div className={`status-badge ${row.status}`}>{STATUS[row.status]||row.status}</div>
    <div className=\"v4-date-cell\">{row.date ? new Date(`${row.date}T12:00:00`).toLocaleDateString('fr-FR') : '—'}</div>
    <div className=\"v4-track-actions\"><div className=\"muted-cell\"><strong>{row.lastActorName||row.lastActorPc||'—'}</strong><small>{row.updatedAt?new Date(row.updatedAt).toLocaleString('fr-FR'):''}</small></div><button type=\"button\" className=\"small-action\" onClick={followup}>Relance</button><small>{row.lastFollowupAt?`${row.lastFollowupAt} · ${row.followupCount}`:'Aucune relance'}</small></div>
  </div>;
}

function TrackingPage({ offers, reload, toast }) {
  const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);
  const rows=useMemo(()=>offers.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');const okQ=!q||[r.folderName,r.title,r.client,r.be,r.ca,r.contact,r.destinationName,r.createdByName,r.lastActorName].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q));return okQ&&(!status||r.status===status)&&(!destination||r.destinationName===destination);}),[offers,query,status,destination]);
  const destinations=[...new Set(offers.map(x=>x.destinationName).filter(Boolean))].sort();
  async function scan(){try{const r=await api('/api/scan-status',{method:'POST'});await reload();toast({message:r.changed?`${r.changed} changement(s) détecté(s).`:'Aucun changement détecté.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className=\"content history-page v4-compact-page\"><header className=\"page-title history-title\"><div><span className=\"eyebrow\">Pilotage</span><h1>Suivi des AO</h1></div><button type=\"button\" className=\"secondary-button\" onClick={scan}><Icon name=\"refresh\" size={15}/>Scanner les emplacements</button></header><div className=\"v4-filters v4-filters-3\"><label className=\"search-box\"><Icon name=\"search\" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder=\"Rechercher\"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value=\"\">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={destination} onChange={e=>setDestination(e.target.value)}><option value=\"\">Toutes les destinations</option>{destinations.map(d=><option key={d}>{d}</option>)}</select></div><section className=\"v4-table-card\"><div className=\"v4-track-row head\"><span>AO</span><span>Client / BE</span><span>Contact</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Suivi</span></div>{!rows.length?<div className=\"empty-state\"><strong>Aucun AO</strong></div>:rows.map(row=><TrackingRowV4 key={row.uid} row={row} followup={()=>setFollowup(row)}/>)}</section>{followup&&<FollowupModalV4 row={followup} close={()=>setFollowup(null)} reload={reload} toast={toast}/>}</main>;
}

"""
s = replace_between(s, 'function TrackingRowV4(', 'function LogsPage(', tracking_block, 'tracking/contact')

dest_block = """function DestinationSettingsV4({settings,reload,toast}){
  const [tab,setTab]=useState('creation');
  return <section className=\"settings-panel\"><header className=\"panel-title\"><div><span className=\"eyebrow\">Emplacements</span><h2>Destinations</h2></div></header><div className=\"v4-destination-switch\"><button type=\"button\" className={tab==='creation'?'active':''} onClick={()=>setTab('creation')}><span className=\"v4-switch-icon\"><Icon name=\"create\" size={18}/></span><span><strong>Création</strong><small>Où les nouveaux AO sont créés</small></span></button><button type=\"button\" className={tab==='transfer'?'active':''} onClick={()=>setTab('transfer')}><span className=\"v4-switch-icon\"><Icon name=\"transfer\" size={18}/></span><span><strong>Transfert</strong><small>Services et dossiers 2 / 3 / 4 / 5</small></span></button></div>{tab==='creation'?<><p>Emplacements proposés lorsque l’AO est créé pour la première fois.</p><DestinationEditorV4 mode=\"creation\" destinations={settings.destinations||[]} reload={reload} toast={toast}/></>:<><p>Un chemin correspond à la racine d’un service (CET, CES…). Le transfert place automatiquement l’AO dans le sous-dossier commençant par <strong>2 </strong>. Les statuts sont ensuite détectés avec les dossiers <strong>2 / 3 / 4 / 5</strong>, quel que soit le texte après le numéro.</p><DestinationEditorV4 mode=\"transfer\" destinations={settings.transferDestinations||[]} reload={reload} toast={toast}/></>}</section>;
}

"""
s = replace_between(s, 'function DestinationSettingsV4(', 'function mapTreeV4(', dest_block, 'destination switch')

settings_block = """function BackupsPanelV4({toast}){
  const [backups,setBackups]=useState([]);const [busy,setBusy]=useState(false);
  async function load(){try{setBackups(await api('/api/backups'));}catch(error){toast({type:'error',message:error.message});}}
  useEffect(()=>{load();},[]);
  async function createNow(){try{setBusy(true);await api('/api/backups',{method:'POST'});await load();toast({message:'Sauvegarde créée.'});}catch(error){toast({type:'error',message:error.message});}finally{setBusy(false);}}
  async function restore(item){
    if(!window.createurAO?.restoreBackup)return toast({type:'error',message:'La restauration est disponible dans l’application Windows.'});
    if(!confirm(`Restaurer la sauvegarde du ${new Date(item.createdAt).toLocaleString('fr-FR')} ?\\n\\nFermez Créateur d’AO sur les autres postes avant une restauration, afin d’éviter qu’ils écrivent dans la base maître pendant l’opération.`))return;
    try{setBusy(true);await window.createurAO.restoreBackup(item.path);toast({message:'Sauvegarde restaurée. Rechargement…'});}catch(error){toast({type:'error',message:String(error?.message||error)});setBusy(false);}
  }
  const size=n=>n?`${(Number(n)/1024/1024).toFixed(1)} Mo`:'—';
  return <section className=\"settings-panel\"><header className=\"panel-title\"><div><span className=\"eyebrow\">Sécurité</span><h2>Sauvegardes</h2></div><button type=\"button\" className=\"secondary-button\" onClick={createNow} disabled={busy}><Icon name=\"refresh\" size={15}/>{busy?'Patiente…':'Sauvegarder maintenant'}</button></header><p>Une sauvegarde automatique est créée chaque jour. Les 10 plus récentes sont conservées. Si une base maître est configurée, sa copie est incluse avec la base locale.</p><div className=\"v4-backup-list\">{!backups.length?<div className=\"v4-backup-empty\">Aucune sauvegarde pour le moment.</div>:backups.map(item=><div className=\"v4-backup-row\" key={item.name}><div><strong>{new Date(item.createdAt).toLocaleString('fr-FR')}</strong><small>{item.kind==='daily'?'Automatique':item.kind==='pre-restore'?'Avant restauration':'Manuelle'} · {size(item.databaseSize)}{item.hasMaster?' · base maître incluse':''}</small></div><button type=\"button\" className=\"secondary-button\" onClick={()=>restore(item)} disabled={busy}>Restaurer</button></div>)}</div></section>;
}

function SettingsPage({ settings, reloadSettings, toast }) {
  const [shared,setShared]=useState({masterRoot:settings.masterRoot||''});
  const [actors,setActors]=useState([]);const [actorDrafts,setActorDrafts]=useState({});const [sync,setSync]=useState(null);
  useEffect(()=>setShared({masterRoot:settings.masterRoot||''}),[settings.masterRoot]);
  async function browse(){if(!window.createurAO?.chooseFolder)return toast({type:'error',message:'Sélecteur disponible dans l’application Windows.'});const p=await window.createurAO.chooseFolder(shared.masterRoot||'');if(p)setShared({masterRoot:p});}
  async function saveShared(){try{await api('/api/settings/shared',{method:'PUT',body:JSON.stringify(shared)});await reloadSettings();toast({message:'Base maître enregistrée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function syncNow(){try{const r=await api('/api/sync/run',{method:'POST'});setSync(r);toast({type:r.error?'error':'',message:r.error||'Synchronisation terminée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function loadActors(){const rows=await api('/api/actors');setActors(rows);setActorDrafts(Object.fromEntries(rows.map(a=>[a.pcId,a.displayName||''])));}
  useEffect(()=>{loadActors();api('/api/sync/status').then(setSync).catch(()=>{});},[]);
  async function saveActor(a){try{const displayName=actorDrafts[a.pcId]??'';await api(`/api/actors/${encodeURIComponent(a.pcId)}`,{method:'PUT',body:JSON.stringify({displayName})});await loadActors();toast({message:'Nom enregistré.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className=\"content settings-page v4-compact-page\"><header className=\"page-title\"><div><span className=\"eyebrow\">Configuration</span><h1>Réglages</h1></div></header>
    <section className=\"settings-panel\"><header className=\"panel-title\"><div><span className=\"eyebrow\">Multi-postes</span><h2>Base maître</h2></div><button type=\"button\" className=\"secondary-button\" onClick={syncNow}><Icon name=\"refresh\" size={15}/>Synchroniser</button></header><p>Choisis le dossier commun du serveur. L’application y crée automatiquement <code>Createur-AO-Base</code>. Le SQLite reste local : aucun fichier SQLite n’est ouvert directement à travers le réseau.</p><div className=\"v4-settings-grid v4-settings-grid-single\"><Field label=\"Dossier serveur maître\" wide><div className=\"v4-path\"><input value={shared.masterRoot} onChange={e=>setShared({masterRoot:e.target.value})} placeholder=\"Choisir le dossier commun\"/><button type=\"button\" onClick={browse}><Icon name=\"folder\"/></button></div></Field></div><div className=\"v4-settings-footer\"><span>PC : <strong>{settings.peerId}</strong>{sync?.lastSync?` · dernière synchro ${new Date(sync.lastSync).toLocaleTimeString('fr-FR')}`:''}{sync?.error?<em> · {sync.error}</em>:''}</span><button type=\"button\" className=\"primary-button\" onClick={saveShared}>Enregistrer</button></div></section>
    <DestinationSettingsV4 settings={settings} reload={reloadSettings} toast={toast}/>
    <TreeEditorV4 initialTree={settings.tree||[]} reload={reloadSettings} toast={toast}/>
    <section className=\"settings-panel\"><header className=\"panel-title\"><div><span className=\"eyebrow\">Identification</span><h2>Personnes</h2></div><Icon name=\"users\"/></header><p>Le nom affiché est modifiable directement ci-dessous. Le PC courant est mis en évidence.</p><div className=\"v4-actor-list\">{actors.map(a=><div className={`v4-actor-row ${a.pcId===settings.peerId?'current':''}`} key={a.pcId}><div className=\"v4-actor-id\"><code>{a.pcId}</code>{a.pcId===settings.peerId&&<span>Ce PC</span>}</div><input type=\"text\" autoComplete=\"off\" value={actorDrafts[a.pcId]??''} onChange={e=>setActorDrafts(v=>({...v,[a.pcId]:e.target.value}))} placeholder=\"Nom de la personne\"/><button type=\"button\" className=\"secondary-button\" onClick={()=>saveActor(a)}>Enregistrer</button></div>)}</div></section>
    <BackupsPanelV4 toast={toast}/>
    <BootstrapPanelV4 settings={settings} reload={reloadSettings} toast={toast}/>
  </main>;
}

"""
s = replace_between(s, 'function SettingsPage(', 'export default function AppV4()', settings_block, 'settings actors/backups')
app_path.write_text(s, encoding='utf-8')


# ---- CSS -----------------------------------------------------------------
css_path = ROOT / 'src' / 'styles-v4.css'
css = css_path.read_text(encoding='utf-8')
marker = '/* beta2-readable */'
if marker not in css:
    css += r'''

/* beta2-readable */
:root{--sidebar:204px}.sidebar{padding:22px 14px 16px}.brand{height:48px}.brand-mark{width:36px;height:36px;font-size:15px}.brand-name{font-size:13px}.sidebar nav{margin-top:28px}.sidebar nav button,.settings-link{height:43px;font-size:12px}.v4-compact-page{padding-top:34px;padding-right:clamp(30px,4vw,68px);padding-bottom:48px;padding-left:clamp(30px,4vw,68px)}.v4-compact-page .page-title{min-height:52px;margin-bottom:22px}.v4-compact-page h1{font-size:clamp(30px,2.05vw,36px)}.v4-compact-card{padding:30px 32px}.v4-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:15px 18px}.v4-field{gap:7px}.v4-field>span{font-size:12px}.v4-field input,.v4-field select{height:44px;border-radius:10px;padding:0 12px;font-size:13px}.v4-folder-picker{padding:14px 16px;margin-bottom:18px;border-radius:12px}.folder-preview{margin-top:20px;padding:14px 16px}.folder-preview code{font-size:13px}.create-actions{padding-top:18px}.primary-button{min-height:42px}.secondary-button{min-height:39px}.primary-button,.secondary-button,.small-action,.add-destination{font-size:11.5px}.settings-panel{padding:28px 30px}.settings-panel>p{font-size:12px}.v4-track-row{grid-template-columns:minmax(210px,1.45fr) minmax(120px,.72fr) minmax(145px,.9fr) minmax(105px,.66fr) 100px 98px minmax(160px,.9fr);gap:10px;padding:11px 14px;min-height:62px}.v4-track-row.head{min-height:40px}.v4-contact-link,.v4-contact-text{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.v4-contact-link{color:#315f88;text-decoration:none}.v4-contact-link:hover{text-decoration:underline}.status-badge.introuvable{background:#f3eeee;color:#914b4b}.v4-destination-switch{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 20px}.v4-destination-switch button{min-height:72px;display:grid;grid-template-columns:40px 1fr;align-items:center;gap:12px;padding:12px 14px;border:1px solid #dedbd3;border-radius:12px;background:#faf9f6;color:#69645d;text-align:left;cursor:pointer}.v4-destination-switch button:hover{background:#fff;border-color:#d1ccc2}.v4-destination-switch button.active{border-color:#e76d48;background:#fff7f3;color:#25241f;box-shadow:0 0 0 3px rgba(231,109,72,.08)}.v4-switch-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:10px;background:#f0eee8}.v4-destination-switch button.active .v4-switch-icon{background:#ffe9e1;color:#d95f3a}.v4-destination-switch strong{display:block;font-size:13px}.v4-destination-switch small{display:block;margin-top:4px;color:#918b82;font-size:11px}.v4-actor-list{gap:10px}.v4-actor-row{grid-template-columns:220px minmax(260px,1fr) 120px!important;padding:10px;border:1px solid #ece9e2;border-radius:11px;background:#fcfbf8}.v4-actor-row.current{border-color:#e7c6ba;background:#fff9f6}.v4-actor-id{display:flex;align-items:center;gap:8px;min-width:0}.v4-actor-id code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.v4-actor-id span{flex:0 0 auto;padding:4px 7px;border-radius:999px;background:#ffe9e1;color:#b65435;font-size:9px;font-weight:800}.v4-actor-row input{height:40px!important;font-size:12px!important}.v4-backup-list{display:grid;gap:9px;margin-top:16px}.v4-backup-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 14px;border:1px solid #e8e5de;border-radius:11px;background:#fbfaf7}.v4-backup-row>div{min-width:0}.v4-backup-row strong{display:block;font-size:12px}.v4-backup-row small{display:block;margin-top:4px;color:#928c83;font-size:10px}.v4-backup-empty{padding:18px;border:1px dashed #dedbd3;border-radius:11px;color:#918b82;font-size:12px;text-align:center}@media(max-width:1250px){.v4-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v4-track-row{min-width:1080px}}@media(max-width:980px){.v4-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v4-destination-switch{grid-template-columns:1fr}.v4-actor-row{grid-template-columns:1fr!important}.v4-backup-row{align-items:flex-start;flex-direction:column}}
'''
css_path.write_text(css, encoding='utf-8')


# ---- Backend: missing folders + backups ---------------------------------
server_path = ROOT / 'server-v4.mjs'
s = server_path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "const DB_FILE = path.join(DATA_DIR, 'createur-ao.db');\nconst DIST_DIR = path.join(ROOT, 'dist');",
    "const DB_FILE = path.join(DATA_DIR, 'createur-ao.db');\nconst BACKUP_DIR = path.join(DATA_DIR, 'backups');\nconst BACKUP_KEEP = 10;\nconst BACKUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;\nconst DIST_DIR = path.join(ROOT, 'dist');",
    'backup constants'
)
s = replace_once(
    s,
    "const STATUS_VALUES = new Set(['a_attribuer', 'en_cours', 'envoye', 'gagne', 'perdu']);",
    "const STATUS_VALUES = new Set(['a_attribuer', 'en_cours', 'envoye', 'gagne', 'perdu', 'introuvable']);",
    'backend status introuvable'
)

scan_and_backup = r'''let scanBusy = false;
async function markMissingOffers() {
  let changed = 0;
  const rows = db.prepare('SELECT uid,folder_name,status,final_path,base_path FROM offers').all();
  for (const row of rows) {
    if (!row.final_path) continue;
    const finalStat = await fsp.stat(row.final_path).catch(() => null);
    if (finalStat?.isDirectory()) {
      if (row.status === 'introuvable') {
        db.prepare("UPDATE offers SET status='a_attribuer',last_actor_pc=?,updated_at=? WHERE uid=?").run('SYSTEM', nowIso(), row.uid);
        const fresh = offerByUid(row.uid);
        queueEvent({ type:'offer.snapshot', offerUid:row.uid, payload:{offer:serializeOffer(fresh)}, action:'Dossier retrouvé', details:row.final_path, status:fresh.status });
        changed += 1;
      }
      continue;
    }
    const baseStat = row.base_path ? await fsp.stat(row.base_path).catch(() => null) : null;
    if (!baseStat?.isDirectory()) continue; // chemin réseau indisponible : ne pas conclure à une suppression
    if (row.status === 'introuvable') continue;
    db.prepare("UPDATE offers SET status='introuvable',last_actor_pc=?,updated_at=? WHERE uid=?").run('SYSTEM', nowIso(), row.uid);
    const fresh = offerByUid(row.uid);
    queueEvent({ type:'offer.snapshot', offerUid:row.uid, payload:{offer:serializeOffer(fresh)}, action:'Dossier introuvable', details:row.final_path, status:'introuvable' });
    changed += 1;
  }
  return changed;
}
async function scanStatuses() {
  if (scanBusy) return { changed: 0 };
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
    changed += await markMissingOffers();
    return { changed };
  } finally { scanBusy = false; }
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function localTimeKey(date = new Date()) {
  return `${localDateKey(date)}-${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
}
async function backupRows() {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const entries = await fsp.readdir(BACKUP_DIR, { withFileTypes: true }).catch(() => []);
  const rows = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('backup-')) continue;
    const folder = path.join(BACKUP_DIR, entry.name);
    let meta = {};
    try { meta = JSON.parse(await fsp.readFile(path.join(folder, 'meta.json'), 'utf8')); } catch {}
    const stat = await fsp.stat(folder).catch(() => null);
    const dbStat = await fsp.stat(path.join(folder, 'createur-ao.db')).catch(() => null);
    if (!dbStat?.isFile()) continue;
    rows.push({
      name: entry.name,
      path: folder,
      createdAt: meta.createdAt || stat?.mtime?.toISOString?.() || nowIso(),
      kind: meta.kind || 'manual',
      hasMaster: !!meta.hasMaster,
      databaseSize: dbStat.size
    });
  }
  rows.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows;
}
async function pruneBackups() {
  const rows = await backupRows();
  for (const row of rows.slice(BACKUP_KEEP)) await fsp.rm(row.path, { recursive: true, force: true });
}
let backupBusy = false;
async function createSystemBackup({ force = false, kind = 'daily' } = {}) {
  if (backupBusy) throw new Error('Une sauvegarde est déjà en cours.');
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  const now = new Date();
  const dailyName = `backup-${localDateKey(now)}`;
  if (!force) {
    const existing = path.join(BACKUP_DIR, dailyName);
    const dbStat = await fsp.stat(path.join(existing, 'createur-ao.db')).catch(() => null);
    if (dbStat?.isFile()) {
      await pruneBackups();
      return (await backupRows()).find(x => x.path === existing) || null;
    }
  }
  backupBusy = true;
  const baseName = force ? `backup-${localTimeKey(now)}` : dailyName;
  let name = baseName;
  let finalPath = path.join(BACKUP_DIR, name);
  if (force && fs.existsSync(finalPath)) {
    name = `${baseName}-${Date.now()}`;
    finalPath = path.join(BACKUP_DIR, name);
  }
  const tempPath = path.join(BACKUP_DIR, `.${name}-${process.pid}-${Date.now()}`);
  try {
    while (syncBusy) await new Promise(r => setTimeout(r, 100));
    await syncMaster();
    while (syncBusy) await new Promise(r => setTimeout(r, 100));
    await fsp.mkdir(tempPath, { recursive: true });
    await db.backup(path.join(tempPath, 'createur-ao.db'));
    const master = masterBaseDir();
    const masterStat = master ? await fsp.stat(master).catch(() => null) : null;
    const hasMaster = !!masterStat?.isDirectory();
    if (hasMaster) await fsp.cp(master, path.join(tempPath, 'master'), { recursive: true });
    await fsp.writeFile(path.join(tempPath, 'meta.json'), JSON.stringify({
      version: 1,
      createdAt: nowIso(),
      kind,
      peerId: PEER_ID,
      masterRoot: getSetting('master_root'),
      masterBasePath: master,
      hasMaster
    }, null, 2), 'utf8');
    await fsp.rename(tempPath, finalPath);
    await pruneBackups();
    return (await backupRows()).find(x => x.path === finalPath) || null;
  } catch (error) {
    await fsp.rm(tempPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  } finally { backupBusy = false; }
}

'''
s = replace_between(s, 'let scanBusy = false;', 'const app = express();', scan_and_backup, 'scan + backup helpers')

s = replace_once(
    s,
    "app.post('/api/scan-status', async (_req, res) => res.json(await scanStatuses()));",
    "app.post('/api/scan-status', async (_req, res) => res.json(await scanStatuses()));\napp.get('/api/backups', async (_req,res)=>{try{res.json(await backupRows());}catch(error){res.status(500).json({error:String(error?.message||error)});}});\napp.post('/api/backups', async (_req,res)=>{try{res.status(201).json(await createSystemBackup({force:true,kind:'manual'}));}catch(error){res.status(500).json({error:String(error?.message||error)});}});",
    'backup routes'
)

s = replace_once(
    s,
    "const server = app.listen(PORT,'127.0.0.1',()=>console.log(`API Créateur d’AO v0.4 prête sur ${PORT} (${PEER_ID}).`));\nconst syncTimer = setInterval(syncMaster,SYNC_INTERVAL_MS); syncTimer.unref?.();\nconst scanTimer = setInterval(scanStatuses,STATUS_SCAN_INTERVAL_MS); scanTimer.unref?.();\nsetTimeout(syncMaster,800).unref?.();\nsetTimeout(scanStatuses,5000).unref?.();\nfunction close(){clearInterval(syncTimer);clearInterval(scanTimer);server.close(()=>{db.close();process.exit(0);});}",
    "const server = app.listen(PORT,'127.0.0.1',()=>console.log(`API Créateur d’AO v0.4 prête sur ${PORT} (${PEER_ID}).`));\nconst syncTimer = setInterval(syncMaster,SYNC_INTERVAL_MS); syncTimer.unref?.();\nconst scanTimer = setInterval(scanStatuses,STATUS_SCAN_INTERVAL_MS); scanTimer.unref?.();\nconst backupTimer = setInterval(()=>{createSystemBackup().catch(error=>console.error('Sauvegarde automatique:',error));},BACKUP_CHECK_INTERVAL_MS); backupTimer.unref?.();\nsetTimeout(syncMaster,800).unref?.();\nsetTimeout(scanStatuses,5000).unref?.();\nsetTimeout(()=>{createSystemBackup().catch(error=>console.error('Sauvegarde automatique:',error));},2500).unref?.();\nfunction close(){clearInterval(syncTimer);clearInterval(scanTimer);clearInterval(backupTimer);server.close(()=>{db.close();process.exit(0);});}",
    'backup timer'
)
server_path.write_text(s, encoding='utf-8')


# ---- Electron: external links + safe restore -----------------------------
main_path = ROOT / 'desktop' / 'main.cjs'
s = main_path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "const { app, BrowserWindow, dialog, ipcMain } = require('electron');",
    "const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');",
    'electron shell import'
)

s = replace_once(
    s,
    "function stopBackend() {\n  if (!backendProcess || backendProcess.killed) return;\n  backendProcess.kill();\n  backendProcess = null;\n}\n",
    "function stopBackend() {\n  if (!backendProcess || backendProcess.killed) return;\n  backendProcess.kill();\n  backendProcess = null;\n}\n\nasync function stopBackendAndWait() {\n  const child = backendProcess;\n  if (!child) return;\n  if (child.exitCode !== null) { backendProcess = null; return; }\n  await new Promise((resolve, reject) => {\n    let settled = false;\n    const finish = () => { if (!settled) { settled = true; resolve(); } };\n    child.once('exit', finish);\n    child.kill();\n    setTimeout(() => {\n      if (settled) return;\n      if (child.exitCode === null) { reject(new Error('Le service interne ne s’est pas arrêté correctement.')); return; }\n      finish();\n    }, 3500);\n  });\n  backendProcess = null;\n}\n",
    'wait backend stop'
)

s = replace_once(
    s,
    "  const targetUrl = process.env.AO_DEV_URL || `http://127.0.0.1:${PROD_PORT}`;\n  mainWindow.loadURL(targetUrl);",
    "  const targetUrl = process.env.AO_DEV_URL || `http://127.0.0.1:${PROD_PORT}`;\n  mainWindow.webContents.setWindowOpenHandler(({ url }) => {\n    if (/^(https?:|mailto:)/i.test(url)) void shell.openExternal(url);\n    return { action: 'deny' };\n  });\n  mainWindow.loadURL(targetUrl);",
    'external links'
)

restore_handler = r'''
ipcMain.handle('backup:restore', async (_event, requestedPath = '') => {
  if (!app.isPackaged) throw new Error('La restauration complète est disponible dans l’application Windows installée.');
  const dataDir = app.getPath('userData');
  const backupRoot = path.resolve(path.join(dataDir, 'backups'));
  const source = path.resolve(String(requestedPath || ''));
  if (path.dirname(source) !== backupRoot || !path.basename(source).startsWith('backup-')) throw new Error('Sauvegarde invalide.');
  const sourceDb = path.join(source, 'createur-ao.db');
  const sourceMeta = path.join(source, 'meta.json');
  if (!fs.existsSync(sourceDb) || !fs.existsSync(sourceMeta)) throw new Error('Sauvegarde incomplète.');
  const fd = await fsp.open(sourceDb, 'r');
  try {
    const header = Buffer.alloc(16);
    await fd.read(header, 0, 16, 0);
    if (header.toString('utf8') !== 'SQLite format 3\u0000') throw new Error('Le fichier de sauvegarde SQLite est invalide.');
  } finally { await fd.close(); }
  const meta = JSON.parse(await fsp.readFile(sourceMeta, 'utf8'));
  const dbFile = path.join(dataDir, 'createur-ao.db');
  const safetyName = `backup-pre-restore-${new Date().toISOString().replace(/[:.]/g,'-')}`;
  const safety = path.join(backupRoot, safetyName);
  let currentMaster = '';
  const sourceMaster = path.join(source, 'master');
  if (meta?.masterBasePath) currentMaster = String(meta.masterBasePath);
  await fsp.mkdir(safety, { recursive: true });
  await stopBackendAndWait();
  try {
    if (fs.existsSync(dbFile)) await fsp.copyFile(dbFile, path.join(safety, 'createur-ao.db'));
    if (currentMaster && fs.existsSync(currentMaster)) await fsp.cp(currentMaster, path.join(safety, 'master'), { recursive: true });
    await fsp.writeFile(path.join(safety, 'meta.json'), JSON.stringify({ createdAt:new Date().toISOString(), kind:'pre-restore', masterBasePath:currentMaster, hasMaster:!!currentMaster }, null, 2), 'utf8');

    await fsp.copyFile(sourceDb, dbFile);
    await fsp.rm(`${dbFile}-wal`, { force: true }).catch(() => {});
    await fsp.rm(`${dbFile}-shm`, { force: true }).catch(() => {});
    if (meta?.hasMaster && currentMaster && fs.existsSync(sourceMaster)) {
      await fsp.rm(currentMaster, { recursive: true, force: true });
      await fsp.mkdir(path.dirname(currentMaster), { recursive: true });
      await fsp.cp(sourceMaster, currentMaster, { recursive: true });
    }
    await startPackagedBackend();
    setTimeout(() => mainWindow?.reload(), 250);
    return { ok:true };
  } catch (error) {
    try {
      const safetyDb = path.join(safety, 'createur-ao.db');
      if (fs.existsSync(safetyDb)) await fsp.copyFile(safetyDb, dbFile);
      const safetyMaster = path.join(safety, 'master');
      if (currentMaster && fs.existsSync(safetyMaster)) {
        await fsp.rm(currentMaster, { recursive:true, force:true });
        await fsp.cp(safetyMaster, currentMaster, { recursive:true });
      }
      await startPackagedBackend();
    } catch {}
    throw error;
  }
});

'''
s = replace_once(s, "app.whenReady().then(async () => {", restore_handler + "app.whenReady().then(async () => {", 'restore IPC')
main_path.write_text(s, encoding='utf-8')

preload_path = ROOT / 'desktop' / 'preload.cjs'
s = preload_path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "  saveConfigFile: (content) => ipcRenderer.invoke('dialog:save-config-file', content)\n});",
    "  saveConfigFile: (content) => ipcRenderer.invoke('dialog:save-config-file', content),\n  restoreBackup: (backupPath) => ipcRenderer.invoke('backup:restore', backupPath)\n});",
    'preload restore'
)
preload_path.write_text(s, encoding='utf-8')


# ---- Tests ---------------------------------------------------------------
test_path = ROOT / 'tests' / 'workflow-v4.test.mjs'
s = test_path.read_text(encoding='utf-8')
s = replace_once(
    s,
    "    const after4=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);\n    assert.equal(after4.status,'gagne');",
    "    const after4=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);\n    assert.equal(after4.status,'gagne');\n    await fs.rm(target4,{recursive:true,force:true});\n    await json(base+'/api/scan-status',{method:'POST'});\n    const missing=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);\n    assert.equal(missing.status,'introuvable');\n    const backup=await json(base+'/api/backups',{method:'POST'});\n    assert.equal(backup.kind,'manual');\n    assert.equal((await fs.stat(path.join(backup.path,'createur-ao.db'))).isFile(),true);",
    'missing + backup test'
)
test_path.write_text(s, encoding='utf-8')


# ---- Version / changelog -------------------------------------------------
for filename in ['package.json', 'package-lock.json']:
    p = ROOT / filename
    data = json.loads(p.read_text(encoding='utf-8'))
    data['version'] = '0.4.1-beta.2'
    if filename == 'package-lock.json' and isinstance(data.get('packages'), dict) and '' in data['packages']:
        data['packages']['']['version'] = '0.4.1-beta.2'
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

changelog = ROOT / 'CHANGELOG.md'
s = changelog.read_text(encoding='utf-8')
if '## v0.4.1-beta.2' not in s:
    s = s.replace('# Changelog\n', '''# Changelog\n\n## v0.4.1-beta.2\n\n- interface réagrandie après le premier compactage, tout en restant visible sans défilement sur la page de création ;\n- colonne Contact ajoutée au suivi, avec ouverture du navigateur pour les URL et du client mail pour les adresses e-mail ;\n- statut `Introuvable` lorsqu’un dossier AO suivi a été supprimé ou déplacé hors des emplacements connus, sans faux positif si le chemin réseau de base est indisponible ;\n- éditeur des noms de personnes fiabilisé dans Réglages, avec le PC courant mis en évidence ;\n- sélecteur Création / Transfert des destinations rendu beaucoup plus visible ;\n- sauvegarde automatique quotidienne de la base locale et, lorsqu’elle existe, de la base maître partagée ; conservation des 10 sauvegardes les plus récentes ;\n- restauration depuis Réglages avec sauvegarde de sécurité préalable.\n''', 1)
changelog.write_text(s, encoding='utf-8')

print('v0.4.1-beta.2 feedback hotfix applied')
