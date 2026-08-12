from pathlib import Path


def replace_between(text, start, end, replacement, label):
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f"start marker missing: {label}")
    j = text.find(end, i + len(start))
    if j < 0:
        raise RuntimeError(f"end marker missing: {label}")
    return text[:i] + replacement + text[j:]


def replace_to_end(text, start, replacement, label):
    i = text.find(start)
    if i < 0:
        raise RuntimeError(f"start marker missing: {label}")
    return text[:i] + replacement


def replace_once(text, old, new, label):
    if old not in text:
        raise RuntimeError(f"pattern missing: {label}")
    return text.replace(old, new, 1)


# Folder naming: commercial and Onaya quote stay truly optional while their underscore slots remain.
p = Path('lib/folders-v4.mjs')
s = p.read_text(encoding='utf-8')
s = replace_once(s, """    title,
    commercial || 'XX',
    quoteNumber || 'XX'
""", """    title,
    commercial,
    quoteNumber
""", 'optional name slots')
s = replace_once(s, """    const quoteNumber = rest.pop() || 'XX';
    const commercial = rest.pop() || 'XX';
""", """    const quoteNumber = rest.pop() ?? '';
    const commercial = rest.pop() ?? '';
""", 'optional parse slots')
p.write_text(s, encoding='utf-8')


# React UI
p = Path('src/AppV4.jsx')
s = p.read_text(encoding='utf-8')
s = replace_between(s, 'const emptyOffer = () => ({', 'function Field(', """const emptyOffer = () => ({
  date: today(), ca: 'XX', be: '', client: '', title: '', commercial: '', quoteNumber: '',
  contact: '', destinationId: ''
});
const emptyTransfer = () => ({
  sourcePath: '', offerUid: '', date: today(), ca: 'XX', be: '', client: '', title: '', commercial: '', quoteNumber: '',
  contact: '', destinationId: ''
});
function clean(value) { return String(value || '').trim().replace(/_/g, '-'); }
function preview(form) {
  const [y='AAAA',m='MM',d='JJ'] = String(form.date || '').split('-');
  return [y||'AAAA',m||'MM',d||'JJ',clean(form.ca)||'XX',clean(form.be)||'XX',clean(form.client)||'XX',clean(form.title)||'INTITULE',clean(form.commercial),clean(form.quoteNumber)].join('_');
}
""", 'offer defaults')

s = replace_between(s, 'function CreatePage(', 'function TransferPage(', """function CreatePage({ settings, reload, toast }) {
  const [form,setForm] = useState(emptyOffer());
  const [busy,setBusy] = useState(false);
  const update = (k,v) => setForm((x) => ({...x,[k]:v}));
  async function submit(e) {
    e.preventDefault();
    if (!form.be.trim() && !form.client.trim()) return toast({type:'error',message:'Renseigne le bureau d’étude ou le client.'});
    try {
      setBusy(true);
      const result = await api('/api/offers',{method:'POST',body:JSON.stringify(form)});
      toast({message:`Dossier créé : ${result.folderName}`});
      setForm(emptyOffer()); await reload();
    } catch(error) { toast({type:'error',message:error.message}); }
    finally { setBusy(false); }
  }
  return <main className="content v4-compact-page">
    <header className="page-title"><div><span className="eyebrow">Nouveau dossier</span><h1>Créer un appel d’offres</h1></div></header>
    <form className="create-card v4-compact-card" onSubmit={submit}>
      <div className="v4-grid">
        <Field label="Date AO · échéance"><input type="date" required value={form.date} onChange={e=>update('date',e.target.value)}/></Field>
        <Field label="Chargé d’affaires · CA"><input required value={form.ca} onChange={e=>update('ca',e.target.value.toUpperCase())}/></Field>
        <Field label="Bureau d’étude · BE"><input value={form.be} onChange={e=>update('be',e.target.value.toUpperCase())} placeholder="BE ou vide si Client"/></Field>
        <Field label="Client"><input value={form.client} onChange={e=>update('client',e.target.value.toUpperCase())} placeholder="Client ou vide si BE"/></Field>
        <Field label="Intitulé" wide><input required value={form.title} onChange={e=>update('title',e.target.value)} placeholder="Restructuration du bâtiment"/></Field>
        <Field label="Commercial · facultatif"><input value={form.commercial} onChange={e=>update('commercial',e.target.value.toUpperCase())} placeholder="Laisser vide"/></Field>
        <Field label="N° devis Onaya · facultatif"><input value={form.quoteNumber} onChange={e=>update('quoteNumber',e.target.value.toUpperCase())} placeholder="Laisser vide"/></Field>
        <Field label="Destination de création"><select required value={form.destinationId} onChange={e=>update('destinationId',e.target.value)}><option value="">Choisir</option>{settings.destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="Nom, mail, téléphone…"/></Field>
      </div>
      <div className="folder-preview"><span>Nom généré</span><code>{preview(form)}</code></div>
      <div className="create-actions"><button className="primary-button" disabled={busy || !settings.destinations.length}><Icon name="create" size={16}/>{busy?'Création…':'Créer le dossier'}</button></div>
    </form>
  </main>;
}

""", 'CreatePage')

s = replace_between(s, 'function TransferPage(', 'function FollowupModalV4(', """function TransferPage({ settings, reload, toast }) {
  const [form,setForm] = useState(emptyTransfer());
  const [busy,setBusy] = useState(false);
  const update = (k,v) => setForm(x=>({...x,[k]:v}));
  async function choose() {
    if (!window.createurAO?.chooseFolder) return toast({type:'error',message:'Le sélecteur natif est disponible dans l’application Windows.'});
    try {
      const selected = await window.createurAO.chooseFolder(form.sourcePath || '');
      if (!selected) return;
      const result = await api('/api/transfer/inspect',{method:'POST',body:JSON.stringify({path:selected})});
      const p = result.parsed || result.offer || {};
      setForm({
        sourcePath:selected, offerUid:result.offer?.uid || '', date:p.date || today(), ca:p.ca || 'XX', be:p.be || '', client:p.client || '',
        title:p.title || '', commercial:p.commercial || '', quoteNumber:p.quoteNumber || '', contact:p.contact || '', destinationId:''
      });
    } catch(error) { toast({type:'error',message:error.message}); }
  }
  async function submit(e) {
    e.preventDefault();
    if (!form.be.trim() && !form.client.trim()) return toast({type:'error',message:'Renseigne le bureau d’étude ou le client.'});
    try {
      setBusy(true);
      const result = await api('/api/transfer/execute',{method:'POST',body:JSON.stringify(form)});
      toast({message:`AO transféré vers ${result.destinationName}.`}); setForm(emptyTransfer()); await reload();
    } catch(error) { toast({type:'error',message:error.message}); }
    finally { setBusy(false); }
  }
  return <main className="content v4-compact-page">
    <header className="page-title"><div><span className="eyebrow">Attribution</span><h1>Transférer un appel d’offres</h1></div></header>
    <form className="create-card v4-compact-card" onSubmit={submit}>
      <button type="button" className="v4-folder-picker" onClick={choose}><Icon name="folder"/><span><strong>{form.sourcePath ? 'Dossier sélectionné' : 'Sélectionner le dossier AO'}</strong><small>{form.sourcePath || 'Sélecteur de dossier Windows'}</small></span></button>
      {form.sourcePath && <>
        <div className="v4-grid v4-transfer-grid">
          <Field label="Date AO · échéance"><input type="date" required value={form.date} onChange={e=>update('date',e.target.value)}/></Field>
          <Field label="CA"><input required value={form.ca} onChange={e=>update('ca',e.target.value.toUpperCase())}/></Field>
          <Field label="BE"><input value={form.be} onChange={e=>update('be',e.target.value.toUpperCase())}/></Field>
          <Field label="Client"><input value={form.client} onChange={e=>update('client',e.target.value.toUpperCase())}/></Field>
          <Field label="Intitulé" wide><input required value={form.title} onChange={e=>update('title',e.target.value)}/></Field>
          <Field label="Commercial · facultatif"><input value={form.commercial} onChange={e=>update('commercial',e.target.value.toUpperCase())}/></Field>
          <Field label="N° devis Onaya · facultatif"><input value={form.quoteNumber} onChange={e=>update('quoteNumber',e.target.value.toUpperCase())}/></Field>
          <Field label="Destination de transfert"><select required value={form.destinationId} onChange={e=>update('destinationId',e.target.value)}><option value="">Choisir</option>{(settings.transferDestinations||[]).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)}/></Field>
        </div>
        <div className="folder-preview"><span>Nouveau nom</span><code>{preview(form)}</code></div>
        <div className="create-actions"><button className="primary-button" disabled={busy || !(settings.transferDestinations||[]).length}><Icon name="transfer" size={16}/>{busy?'Transfert…':'Renommer et transférer'}</button></div>
      </>}
    </form>
  </main>;
}

""", 'TransferPage')

s = replace_between(s, 'function TrackingRowV4(', 'function LogsPage(', """function TrackingRowV4({row,followup}){
  return <div className="v4-track-row">
    <div className="offer-cell"><strong>{row.title}</strong><code>{row.folderName}</code></div>
    <div className="muted-cell">{row.client||row.be||'—'}<small>{row.client&&row.be?`BE : ${row.be}`:''}</small></div>
    <div className="destination-chip">{row.destinationName||'Création'}</div>
    <div className={`status-badge ${row.status}`}>{STATUS[row.status]||row.status}</div>
    <div className="v4-date-cell">{row.date ? new Date(`${row.date}T12:00:00`).toLocaleDateString('fr-FR') : '—'}</div>
    <div className="v4-track-actions"><div className="muted-cell"><strong>{row.lastActorName||row.lastActorPc||'—'}</strong><small>{row.updatedAt?new Date(row.updatedAt).toLocaleString('fr-FR'):''}</small></div><button className="small-action" onClick={followup}>Relance</button><small>{row.lastFollowupAt?`${row.lastFollowupAt} · ${row.followupCount}`:'Aucune relance'}</small></div>
  </div>;
}

function TrackingPage({ offers, reload, toast }) {
  const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);
  const rows=useMemo(()=>offers.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');const okQ=!q||[r.folderName,r.title,r.client,r.be,r.ca,r.destinationName,r.createdByName,r.lastActorName].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q));return okQ&&(!status||r.status===status)&&(!destination||r.destinationName===destination);}),[offers,query,status,destination]);
  const destinations=[...new Set(offers.map(x=>x.destinationName).filter(Boolean))].sort();
  async function scan(){try{const r=await api('/api/scan-status',{method:'POST'});await reload();toast({message:r.changed?`${r.changed} statut(s) détecté(s).`:'Aucun changement détecté.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Pilotage</span><h1>Suivi des AO</h1></div><button className="secondary-button" onClick={scan}><Icon name="refresh" size={15}/>Scanner les emplacements</button></header><div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Toutes les destinations</option>{destinations.map(d=><option key={d}>{d}</option>)}</select></div><section className="v4-table-card"><div className="v4-track-row head"><span>AO</span><span>Client / BE</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Suivi</span></div>{!rows.length?<div className="empty-state"><strong>Aucun AO</strong></div>:rows.map(row=><TrackingRowV4 key={row.uid} row={row} followup={()=>setFollowup(row)}/>)}</section>{followup&&<FollowupModalV4 row={followup} close={()=>setFollowup(null)} reload={reload} toast={toast}/>}</main>;
}

""", 'TrackingPage')

s = replace_between(s, 'function LogsPage(', 'function PathPickerV4(', """function LogsPage({ toast }) {
  const [logs,setLogs] = useState([]); const [actors,setActors] = useState([]); const [query,setQuery]=useState(''); const [actor,setActor]=useState(''); const [status,setStatus]=useState('');
  async function load(){try{const [l,a]=await Promise.all([api('/api/logs'),api('/api/actors')]);setLogs(l);setActors(a);}catch(error){toast({type:'error',message:error.message});}}
  useEffect(()=>{load();},[]);
  const rows=logs.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');return (!q || [r.offerTitle,r.action,r.details,r.actorName,r.actorPcId].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))) && (!actor||r.actorPcId===actor) && (!status||r.status===status);});
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Journal commun</span><h1>Historique</h1></div><button className="secondary-button" onClick={load}><Icon name="refresh" size={15}/>Actualiser</button></header>
    <div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={actor} onChange={e=>setActor(e.target.value)}><option value="">Toutes les personnes</option>{actors.map(a=><option key={a.pcId} value={a.pcId}>{a.displayName || a.pcId}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <section className="v4-table-card"><div className="v4-log-row head"><span>Date</span><span>Personne</span><span>AO</span><span>Action</span><span>Statut</span></div>{rows.map(r=><div className="v4-log-row" key={r.eventId}><span>{new Date(r.createdAt).toLocaleString('fr-FR')}</span><span><strong>{r.actorName}</strong><small>{r.actorPcId}</small></span><span>{r.offerTitle || '—'}</span><span><strong>{r.action}</strong><small>{r.details}</small></span><span>{STATUS[r.status] || r.status || '—'}</span></div>)}</section>
  </main>;
}

""", 'LogsPage')

s = replace_between(s, 'function DestinationEditorV4(', 'function mapTreeV4(', """function DestinationEditorV4({ destinations, reload, toast, mode='creation' }) {
  const [drafts,setDrafts]=useState({});
  const [fresh,setFresh]=useState({name:'',path:''});
  const endpoint=mode==='transfer'?'/api/transfer-destinations':'/api/destinations';
  useEffect(()=>setDrafts(Object.fromEntries(destinations.map(d=>[d.id,{name:d.name,path:d.path}]))),[destinations]);
  async function choose(key){
    if(!window.createurAO?.chooseFolder)return toast({type:'error',message:'Le sélecteur natif est disponible dans l’application Windows.'});
    const initial=key==='new'?fresh.path:(drafts[key]?.path||'');
    try{const selected=await window.createurAO.chooseFolder(initial);if(!selected)return;if(key==='new')setFresh(v=>({...v,path:selected}));else setDrafts(v=>({...v,[key]:{...v[key],path:selected}}));}
    catch(error){toast({type:'error',message:String(error?.message||error)});}
  }
  async function add(){try{await api(endpoint,{method:'POST',body:JSON.stringify(fresh)});setFresh({name:'',path:''});await reload();toast({message:'Destination ajoutée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function save(id){try{await api(`${endpoint}/${id}`,{method:'PUT',body:JSON.stringify(drafts[id])});await reload();toast({message:'Destination enregistrée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function remove(id){if(!confirm('Supprimer cette destination des réglages ?'))return;try{await api(`${endpoint}/${id}`,{method:'DELETE'});await reload();}catch(error){toast({type:'error',message:error.message});}}
  return <div className="destination-list">
    {destinations.map(d=><div className="destination-line" key={d.id}><input value={drafts[d.id]?.name??''} onChange={e=>setDrafts(v=>({...v,[d.id]:{...v[d.id],name:e.target.value}}))} placeholder="Nom"/><PathPickerV4 value={drafts[d.id]?.path??''} onChange={p=>setDrafts(v=>({...v,[d.id]:{...v[d.id],path:p}}))} browse={()=>choose(d.id)}/><button className="save-icon" onClick={()=>save(d.id)} title="Enregistrer"><span>✓</span></button><button className="danger-icon" onClick={()=>remove(d.id)} title="Supprimer"><Icon name="trash" size={15}/></button></div>)}
    <div className="destination-line new-line"><input value={fresh.name} onChange={e=>setFresh(v=>({...v,name:e.target.value}))} placeholder={mode==='transfer'?'Nom (CET, CES…)':'Nom de la destination'}/><PathPickerV4 value={fresh.path} onChange={p=>setFresh(v=>({...v,path:p}))} browse={()=>choose('new')}/><button className="add-destination" onClick={add} disabled={!fresh.name.trim()||!fresh.path.trim()}><Icon name="plus" size={15}/>Ajouter</button></div>
  </div>;
}

function DestinationSettingsV4({settings,reload,toast}){
  const [tab,setTab]=useState('creation');
  return <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Emplacements</span><h2>Destinations</h2></div></header><div className="v4-tabs"><button className={tab==='creation'?'active':''} onClick={()=>setTab('creation')}>Création</button><button className={tab==='transfer'?'active':''} onClick={()=>setTab('transfer')}>Transfert</button></div>{tab==='creation'?<><p>Emplacements proposés lorsque l’AO est créé pour la première fois.</p><DestinationEditorV4 mode="creation" destinations={settings.destinations||[]} reload={reload} toast={toast}/></>:<><p>Un chemin correspond à la racine d’un service (CET, CES…). Le transfert place automatiquement l’AO dans le sous-dossier commençant par <strong>2 </strong>. Les statuts sont ensuite détectés avec les dossiers <strong>2 / 3 / 4 / 5</strong>, quel que soit le texte après le numéro.</p><DestinationEditorV4 mode="transfer" destinations={settings.transferDestinations||[]} reload={reload} toast={toast}/></>}</section>;
}

""", 'Destination editors')

s = replace_once(s, "function buildTemplateV4(settings){return {app:'createur-ao',schemaVersion:2,exportedAt:new Date().toISOString(),destinations:(settings.destinations||[]).map(({name,path})=>({name,path})),tree:settings.tree||[]};}", "function buildTemplateV4(settings){return {app:'createur-ao',schemaVersion:3,exportedAt:new Date().toISOString(),destinations:(settings.destinations||[]).map(({name,path})=>({name,path})),transferDestinations:(settings.transferDestinations||[]).map(({name,path})=>({name,path})),tree:settings.tree||[]};}", 'bootstrap template')

s = replace_between(s, 'function SettingsPage(', 'export default function AppV4()', """function SettingsPage({ settings, reloadSettings, toast }) {
  const [shared,setShared]=useState({masterRoot:settings.masterRoot||''});
  const [actors,setActors]=useState([]);const [sync,setSync]=useState(null);
  useEffect(()=>setShared({masterRoot:settings.masterRoot||''}),[settings.masterRoot]);
  async function browse(){if(!window.createurAO?.chooseFolder)return toast({type:'error',message:'Sélecteur disponible dans l’application Windows.'});const p=await window.createurAO.chooseFolder(shared.masterRoot||'');if(p)setShared({masterRoot:p});}
  async function saveShared(){try{await api('/api/settings/shared',{method:'PUT',body:JSON.stringify(shared)});await reloadSettings();toast({message:'Base maître enregistrée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function syncNow(){try{const r=await api('/api/sync/run',{method:'POST'});setSync(r);toast({type:r.error?'error':'',message:r.error||'Synchronisation terminée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function loadActors(){setActors(await api('/api/actors'));}
  useEffect(()=>{loadActors();api('/api/sync/status').then(setSync).catch(()=>{});},[]);
  async function saveActor(a){try{await api(`/api/actors/${encodeURIComponent(a.pcId)}`,{method:'PUT',body:JSON.stringify({displayName:a.displayName})});await loadActors();toast({message:'Nom enregistré.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className="content settings-page v4-compact-page"><header className="page-title"><div><span className="eyebrow">Configuration</span><h1>Réglages</h1></div></header>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Multi-postes</span><h2>Base maître</h2></div><button className="secondary-button" onClick={syncNow}><Icon name="refresh" size={15}/>Synchroniser</button></header><p>Choisis le dossier commun du serveur. L’application y crée automatiquement <code>Createur-AO-Base</code>. Le SQLite reste local : aucun fichier SQLite n’est ouvert directement à travers le réseau.</p><div className="v4-settings-grid v4-settings-grid-single"><Field label="Dossier serveur maître" wide><div className="v4-path"><input value={shared.masterRoot} onChange={e=>setShared({masterRoot:e.target.value})} placeholder="Choisir le dossier commun"/><button type="button" onClick={browse}><Icon name="folder"/></button></div></Field></div><div className="v4-settings-footer"><span>PC : <strong>{settings.peerId}</strong>{sync?.lastSync?` · dernière synchro ${new Date(sync.lastSync).toLocaleTimeString('fr-FR')}`:''}{sync?.error?<em> · {sync.error}</em>:''}</span><button className="primary-button" onClick={saveShared}>Enregistrer</button></div></section>
    <DestinationSettingsV4 settings={settings} reload={reloadSettings} toast={toast}/>
    <TreeEditorV4 initialTree={settings.tree||[]} reload={reloadSettings} toast={toast}/>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Identification</span><h2>Personnes</h2></div><Icon name="users"/></header><p>Le nom du PC identifie l’auteur. Le nom affiché est modifiable.</p><div className="v4-actor-list">{actors.map((a,i)=><div key={a.pcId}><code>{a.pcId}</code><input value={a.displayName} onChange={e=>setActors(v=>v.map((x,j)=>j===i?{...x,displayName:e.target.value}:x))} placeholder="Nom de la personne"/><button className="secondary-button" onClick={()=>saveActor(a)}>Enregistrer</button></div>)}</div></section>
    <BootstrapPanelV4 settings={settings} reload={reloadSettings} toast={toast}/>
  </main>;
}

""", 'SettingsPage')

s = replace_to_end(s, 'export default function AppV4()', """export default function AppV4() {
  const [active,setActive]=useState('create'); const [settings,setSettings]=useState({destinations:[],transferDestinations:[],tree:[],peerId:'',masterRoot:''}); const [offers,setOffers]=useState([]); const [toastValue,setToastValue]=useState(null); const [loading,setLoading]=useState(true);
  const toast=(v)=>setToastValue({...v,key:Date.now()});
  async function loadSettings(){setSettings(await api('/api/settings'));}
  async function loadOffers(){setOffers(await api('/api/offers'));}
  async function loadAll(){try{await Promise.all([loadSettings(),loadOffers()]);}catch(error){toast({type:'error',message:error.message});}finally{setLoading(false);}}
  useEffect(()=>{loadAll();const timer=setInterval(()=>{loadOffers();},5000);return()=>clearInterval(timer);},[]);
  let page;
  if (loading) page=<main className="content loading"><span/></main>;
  else if(active==='create') page=<CreatePage settings={settings} reload={loadOffers} toast={toast}/>;
  else if(active==='transfer') page=<TransferPage settings={settings} reload={loadOffers} toast={toast}/>;
  else if(active==='tracking') page=<TrackingPage offers={offers} reload={loadOffers} toast={toast}/>;
  else if(active==='history') page=<LogsPage toast={toast}/>;
  else page=<SettingsPage settings={settings} reloadSettings={loadSettings} toast={toast}/>;
  return <div className="app-shell"><Sidebar active={active} setActive={setActive}/>{page}{!loading&&settings.onboardingComplete===false&&<FirstRunV4 reload={async()=>{await loadSettings();await loadOffers();}} manual={async()=>{await loadSettings();setActive('settings');}} toast={toast}/>}<Toast key={toastValue?.key} value={toastValue} close={()=>setToastValue(null)}/></div>;
}
""", 'AppV4 end')
p.write_text(s, encoding='utf-8')


# Backend
p = Path('server-v4.mjs')
s = p.read_text(encoding='utf-8')
s = replace_once(s, """  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
""", """  CREATE TABLE IF NOT EXISTS destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS transfer_destinations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
""", 'transfer table')
s = replace_once(s, """db.prepare("UPDATE offers SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at = '' OR updated_at IS NULL").run();
""", """db.prepare("UPDATE offers SET updated_at = COALESCE(NULLIF(updated_at, ''), created_at, CURRENT_TIMESTAMP) WHERE updated_at = '' OR updated_at IS NULL").run();
db.prepare("UPDATE offers SET due_date = date_ao WHERE COALESCE(due_date, '') <> COALESCE(date_ao, '')").run();
""", 'due date backfill')

s = replace_between(s, 'function publicSettings() {', 'function actorName(', """function publicSettings() {
  return {
    destinations: db.prepare('SELECT id, name, path FROM destinations ORDER BY name COLLATE NOCASE').all(),
    transferDestinations: db.prepare('SELECT id, name, path FROM transfer_destinations ORDER BY name COLLATE NOCASE').all(),
    tree: readTree(),
    onboardingComplete: getSetting('bootstrap_complete') === '1',
    masterRoot: getSetting('master_root'),
    peerId: PEER_ID
  };
}
function sharedConfigSnapshot() {
  return {
    destinations: db.prepare('SELECT name, path FROM destinations ORDER BY name COLLATE NOCASE').all(),
    transferDestinations: db.prepare('SELECT name, path FROM transfer_destinations ORDER BY name COLLATE NOCASE').all(),
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
  const normalizeDestinations=(items)=>items.map(d=>({name:sanitizeSegment(d?.name),path:String(d?.path||'').trim()})).filter(d=>d.name&&d.path);
  const creation=normalizeDestinations(snapshot.destinations);
  const transfer=normalizeDestinations(Array.isArray(snapshot.transferDestinations)?snapshot.transferDestinations:[]);
  const tree=normalizeTree(snapshot.tree);
  assertNoDuplicateSiblings(tree);
  const syncTable=(table,rows)=>{
    const keep=new Set(rows.map(d=>d.name.toLocaleLowerCase('fr')));
    const existing=db.prepare(`SELECT id,name FROM ${table}`).all();
    const upsert=db.prepare(`INSERT INTO ${table} (name,path) VALUES (?,?) ON CONFLICT(name) DO UPDATE SET path=excluded.path`);
    for(const d of rows)upsert.run(d.name,d.path);
    const remove=db.prepare(`DELETE FROM ${table} WHERE id=?`);
    for(const d of existing)if(!keep.has(d.name.toLocaleLowerCase('fr')))remove.run(d.id);
  };
  const tx=db.transaction(()=>{
    syncTable('destinations',creation);
    syncTable('transfer_destinations',transfer);
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
  queueEvent({type:'config.snapshot',payload:{config},action,details:`${config.destinations.length} création · ${config.transferDestinations.length} transfert · arborescence partagée`});
}

""", 'shared config')
s = replace_once(s, """    department: snapshot.department || '', status: normalizeStatus(snapshot.status), dueDate: snapshot.dueDate || '', remark: snapshot.remark || '',
""", """    department: '', status: normalizeStatus(snapshot.status), dueDate: snapshot.date || snapshot.dueDate || '', remark: snapshot.remark || '',
""", 'snapshot due date')

s = replace_between(s, 'async function scanStatusDirectory(', 'let scanBusy = false;', """async function findNumberedChild(root, number) {
  const stat = await fsp.stat(root).catch(() => null);
  if (!stat?.isDirectory()) return '';
  const entries = await fsp.readdir(root, { withFileTypes: true }).catch(() => []);
  const prefix = new RegExp(`^\\s*${number}\\s`, 'i');
  const match = entries.find((entry) => entry.isDirectory() && prefix.test(entry.name));
  return match ? path.join(root, match.name) : '';
}
async function scanStageDirectory(stageRoot, status, destination) {
  if (!stageRoot) return 0;
  let changed = 0;
  const queue = [{ dir: stageRoot, depth: 0 }];
  const byName = new Map(db.prepare('SELECT uid, folder_name, status, final_path, destination_name, base_path, date_ao FROM offers').all().map((r) => [r.folder_name.toLocaleLowerCase('fr'), r]));
  while (queue.length) {
    const { dir, depth } = queue.shift();
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      const offer = byName.get(entry.name.toLocaleLowerCase('fr'));
      if (offer) {
        if (offer.status !== status || offer.final_path !== full || offer.destination_name !== destination.name || offer.base_path !== destination.path) {
          db.prepare("UPDATE offers SET status=?, final_path=?, destination_id=NULL, destination_name=?, base_path=?, department='', due_date=date_ao, last_actor_pc=?, updated_at=? WHERE uid=?")
            .run(status, full, destination.name, destination.path, 'SYSTEM', nowIso(), offer.uid);
          const fresh = offerByUid(offer.uid);
          queueEvent({ type:'offer.snapshot', offerUid:offer.uid, payload:{offer:serializeOffer(fresh)}, action:`Statut détecté : ${status}`, details:full, status });
          changed += 1;
        }
        continue;
      }
      if (depth < 4) queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return changed;
}
""", 'scanner helpers')
s = replace_between(s, 'let scanBusy = false;', 'const app = express();', """let scanBusy = false;
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
    return { changed };
  } finally { scanBusy = false; }
}

""", 'scanner')

s = replace_between(s, "app.put('/api/settings/shared'", "app.get('/api/sync/status'", """app.put('/api/settings/shared', async (req, res) => {
  const masterRoot=String(req.body?.masterRoot||'').trim();
  const previousRoot=getSetting('master_root');
  const seededRoot=getSetting('master_seeded_root');
  const localOffersBefore=db.prepare('SELECT * FROM offers ORDER BY created_at,id').all().map(serializeOffer);
  const localActorsBefore=db.prepare("SELECT pc_id,display_name FROM actors WHERE display_name<>''").all();
  putSetting('master_root',masterRoot);
  if(masterRoot&&seededRoot!==masterRoot){
    const base=await ensureMasterFolders();
    const existingMaster=await masterHasOtherPeerData(base);
    if(existingMaster){
      await pullRemoteEvents(base);
    }else{
      const configAt=nowIso();
      putSetting('shared_config_updated_at',configAt);
      putSetting('shared_config_actor',PEER_ID);
      queueEvent({type:'config.snapshot',payload:{config:sharedConfigSnapshot()},action:'Configuration locale partagée',details:'Destinations création/transfert et arborescence initiales'});
    }
    for(const offer of localOffersBefore){
      queueEvent({type:'offer.snapshot',offerUid:offer.uid,payload:{offer},action:'AO existant partagé',details:offer.folderName,status:offer.status});
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
""", 'master settings')

s = replace_between(s, "app.post('/api/offers'", "app.patch('/api/offers/:uid'", """app.post('/api/offers', async (req, res) => {
  let finalPath = null;
  try {
    const destinationId = Number(req.body?.destinationId);
    const destination = db.prepare('SELECT id,name,path FROM destinations WHERE id=?').get(destinationId);
    if (!destination) throw new Error('Choisissez une destination de création configurée.');
    const payload = {
      date:String(req.body?.date || ''), ca:sanitizeSegment(req.body?.ca,{upper:true}), be:sanitizeSegment(req.body?.be,{upper:true}),
      client:sanitizeSegment(req.body?.client,{upper:true}), title:sanitizeSegment(req.body?.title), commercial:sanitizeSegment(req.body?.commercial,{upper:true}),
      quoteNumber:sanitizeSegment(req.body?.quoteNumber,{upper:true}), contact:String(req.body?.contact ?? '')
    };
    const folderName = buildFolderName(payload);
    const tree = readTree(); assertNoDuplicateSiblings(tree);
    finalPath = await createFolderTree({ fs:fsp, basePath:destination.path, folderName, tree });
    await writeContactsFile({ fs:fsp, rootPath:finalPath, contact:payload.contact });
    const uid = crypto.randomUUID(); const at = nowIso();
    db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,folderName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.id,destination.name,destination.path,finalPath,'','a_attribuer',payload.date,PEER_ID,PEER_ID,at,at);
    const fresh = offerByUid(uid);
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'AO créé', details:folderName, status:fresh.status });
    await syncMaster();
    res.status(201).json(offerPublic(fresh));
  } catch (error) {
    if (finalPath) await fsp.rm(finalPath,{recursive:true,force:true}).catch(()=>{});
    const code = error?.code === 'EEXIST' ? 409 : ['EACCES','EPERM'].includes(error?.code) ? 403 : 400;
    res.status(code).json({ error:String(error?.message || error) });
  }
});

""", 'create endpoint')

s = replace_between(s, "app.patch('/api/offers/:uid'", "app.delete('/api/offers/:uid'", """app.patch('/api/offers/:uid', (req, res) => {
  try {
    const uid = String(req.params.uid);
    const current = offerByUid(uid); if (!current) return res.status(404).json({error:'Appel d’offres introuvable.'});
    const remark = req.body?.remark === undefined ? current.remark : String(req.body.remark || '').trim();
    const at = nowIso();
    db.prepare("UPDATE offers SET due_date=date_ao,department='',remark=?,last_actor_pc=?,updated_at=? WHERE uid=?").run(remark,PEER_ID,at,uid);
    const fresh = offerByUid(uid);
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'Suivi AO modifié', details:remark !== current.remark ? 'remarque modifiée' : '', status:fresh.status });
    res.json(offerPublic(fresh));
  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }
});

""", 'patch endpoint')

s = replace_once(s, """  res.json({ tracked:false, offer:null, parsed:{...parsed, folderName:name, finalPath:selectedPath, contact:'', department:'', dueDate:''} });
""", """  res.json({ tracked:false, offer:null, parsed:{...parsed, folderName:name, finalPath:selectedPath, contact:'', dueDate:parsed.date || ''} });
""", 'inspect defaults')

s = replace_between(s, "app.post('/api/transfer/execute'", "app.post('/api/bootstrap/import'", """app.post('/api/transfer/execute', async (req, res) => {
  let releaseLock = async () => {};
  try {
    const sourcePath = String(req.body?.sourcePath || '').trim();
    if (!sourcePath) throw new Error('Dossier source obligatoire.');
    const destinationId = Number(req.body?.destinationId);
    const destination = db.prepare('SELECT id,name,path FROM transfer_destinations WHERE id=?').get(destinationId);
    if (!destination) throw new Error('Destination de transfert introuvable.');
    const stageTwo = await findNumberedChild(destination.path, 2);
    if (!stageTwo) throw new Error(`Aucun sous-dossier commençant par « 2 » dans ${destination.name}. Vérifiez le chemin de la destination de transfert.`);
    const payload = {
      date:String(req.body?.date || ''), ca:sanitizeSegment(req.body?.ca,{upper:true}), be:sanitizeSegment(req.body?.be,{upper:true}), client:sanitizeSegment(req.body?.client,{upper:true}),
      title:sanitizeSegment(req.body?.title), commercial:sanitizeSegment(req.body?.commercial,{upper:true}), quoteNumber:sanitizeSegment(req.body?.quoteNumber,{upper:true}),
      contact:String(req.body?.contact ?? '')
    };
    const newName = buildFolderName(payload);
    const targetPath = path.join(stageTwo, newName);
    let uid = String(req.body?.offerUid || '').trim();
    const existing = uid ? offerByUid(uid) : db.prepare('SELECT * FROM offers WHERE lower(final_path)=lower(?) OR lower(folder_name)=lower(?) ORDER BY updated_at DESC LIMIT 1').get(sourcePath,path.basename(sourcePath));
    if (!uid && existing) uid = existing.uid;
    if (!uid) uid = crypto.randomUUID();
    releaseLock = await acquireOfferLock(uid);
    await moveDirectory(sourcePath, targetPath);
    const at = nowIso();
    if (existing) {
      db.prepare(`UPDATE offers SET folder_name=?,date_ao=?,ca=?,be=?,client=?,title=?,commercial=?,quote_number=?,contact=?,destination_id=NULL,destination_name=?,base_path=?,final_path=?,department='',status='en_cours',due_date=?,last_actor_pc=?,updated_at=? WHERE uid=?`)
        .run(newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,destination.name,destination.path,targetPath,payload.date,PEER_ID,at,uid);
    } else {
      db.prepare(`INSERT INTO offers (uid,folder_name,date_ao,ca,be,client,title,commercial,quote_number,contact,destination_id,destination_name,base_path,final_path,department,status,due_date,created_by_pc,last_actor_pc,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid,newName,payload.date,payload.ca,payload.be,payload.client,payload.title,payload.commercial,payload.quoteNumber,payload.contact,null,destination.name,destination.path,targetPath,'','en_cours',payload.date,PEER_ID,PEER_ID,at,at);
    }
    const fresh = offerByUid(uid);
    queueEvent({ type:'offer.snapshot', offerUid:uid, payload:{offer:serializeOffer(fresh)}, action:'AO transféré', details:`${sourcePath} → ${targetPath}`, status:fresh.status });
    await syncMaster();
    res.json(offerPublic(fresh));
  } catch (error) {
    const code = error?.code === 'EEXIST' ? 409 : ['EACCES','EPERM'].includes(error?.code) ? 403 : 400;
    res.status(code).json({error:String(error?.message || error)});
  } finally { await releaseLock(); }
});

""", 'transfer endpoint')

s = replace_between(s, "app.post('/api/bootstrap/import'", "app.put('/api/tree'", """app.post('/api/bootstrap/import', (req, res) => {
  try {
    const template = req.body?.template || {};
    const destinations = Array.isArray(template.destinations) ? template.destinations : [];
    const transferDestinations = Array.isArray(template.transferDestinations) ? template.transferDestinations : [];
    const tree = normalizeTree(template.tree);
    if (!destinations.length) throw new Error('Le modèle ne contient aucune destination de création.');
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM destinations').run();
      db.prepare('DELETE FROM transfer_destinations').run();
      const insertCreation = db.prepare('INSERT INTO destinations (name,path) VALUES (?,?)');
      const insertTransfer = db.prepare('INSERT INTO transfer_destinations (name,path) VALUES (?,?)');
      for (const d of destinations) insertCreation.run(sanitizeSegment(d.name), cleanDestinationPath(d.path));
      for (const d of transferDestinations) insertTransfer.run(sanitizeSegment(d.name), cleanDestinationPath(d.path));
      putSetting('folder_tree', JSON.stringify(tree)); putSetting('bootstrap_complete','1');
    }); tx(); queueSharedConfig('Modèle de démarrage importé'); void syncMaster(); res.json(publicSettings());
  } catch (error) { res.status(400).json({error:String(error?.message || error)}); }
});
app.post('/api/bootstrap/skip', (_req,res) => { putSetting('bootstrap_complete','1'); res.json(publicSettings()); });
function destinationCrud(prefix, table, label) {
  app.post(prefix, (req,res) => {
    try { const name=sanitizeSegment(req.body?.name), p=cleanDestinationPath(req.body?.path); if(!name) throw new Error('Nom obligatoire.'); const info=db.prepare(`INSERT INTO ${table} (name,path) VALUES (?,?)`).run(name,p); queueSharedConfig(`${label} ajoutée`); void syncMaster(); res.status(201).json(db.prepare(`SELECT id,name,path FROM ${table} WHERE id=?`).get(info.lastInsertRowid)); }
    catch(error){res.status(String(error.message).includes('UNIQUE')?409:400).json({error:String(error.message).includes('UNIQUE')?'Ce nom de destination existe déjà.':String(error.message||error)});}
  });
  app.put(`${prefix}/:id`,(req,res)=>{try{const id=Number(req.params.id),name=sanitizeSegment(req.body?.name),p=cleanDestinationPath(req.body?.path);const info=db.prepare(`UPDATE ${table} SET name=?,path=? WHERE id=?`).run(name,p,id);if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});queueSharedConfig(`${label} modifiée`);void syncMaster();res.json(db.prepare(`SELECT id,name,path FROM ${table} WHERE id=?`).get(id));}catch(error){res.status(400).json({error:String(error.message||error)});}});
  app.delete(`${prefix}/:id`,(req,res)=>{const info=db.prepare(`DELETE FROM ${table} WHERE id=?`).run(Number(req.params.id));if(!info.changes)return res.status(404).json({error:'Destination introuvable.'});queueSharedConfig(`${label} supprimée`);void syncMaster();res.status(204).end();});
}
destinationCrud('/api/destinations','destinations','Destination de création');
destinationCrud('/api/transfer-destinations','transfer_destinations','Destination de transfert');
""", 'destination endpoints')
p.write_text(s, encoding='utf-8')


# Compact CSS overrides
p = Path('src/styles-v4.css')
s = p.read_text(encoding='utf-8')
if '/* compact-v4-2 */' not in s:
    s += """
/* compact-v4-2 */
:root{--sidebar:190px}.sidebar{padding:18px 12px 14px}.brand{height:44px}.brand-mark{width:33px;height:33px}.sidebar nav{margin-top:22px}.sidebar nav button,.settings-link{height:39px}.v4-compact-page{padding-top:24px;padding-right:clamp(20px,3.5vw,54px);padding-bottom:34px;padding-left:clamp(20px,3.5vw,54px)}.v4-compact-page .page-title{min-height:44px;margin-bottom:16px}.v4-compact-page h1{font-size:clamp(25px,1.8vw,32px)}.v4-compact-card{min-height:0;padding:22px 24px}.v4-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:11px 14px}.v4-grid .wide{grid-column:span 2}.v4-field{gap:5px}.v4-field>span{font-size:11px}.v4-field input,.v4-field select{height:38px;border-radius:9px;padding:0 10px;font-size:12px}.v4-folder-picker{padding:11px 14px;margin-bottom:14px;border-radius:11px}.folder-preview{margin-top:16px;padding:11px 13px}.folder-preview span{margin-bottom:4px}.create-actions{padding-top:14px}.primary-button{min-height:38px}.v4-filters{margin-bottom:10px}.v4-filters-3{grid-template-columns:minmax(240px,1fr) minmax(150px,210px) minmax(170px,230px)}.v4-track-row{grid-template-columns:minmax(230px,1.7fr) minmax(120px,.8fr) minmax(110px,.7fr) minmax(100px,.65fr) 96px minmax(155px,.9fr);gap:9px;padding:9px 12px;min-height:56px}.v4-track-row.head{min-height:36px}.v4-date-cell{font-size:12px;color:#68645d}.status-badge{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 9px;border-radius:999px;font-size:11px;font-weight:750;width:max-content;max-width:100%}.status-badge.a_attribuer{background:#f5f3ee}.status-badge.en_cours{background:#fff5db}.status-badge.envoye{background:#edf5ff}.status-badge.gagne{background:#eaf7ee}.status-badge.perdu{background:#fff0ef}.v4-log-row{grid-template-columns:135px minmax(130px,.8fr) minmax(150px,1fr) minmax(220px,1.6fr) 110px;gap:11px;padding:10px 12px;font-size:12px}.v4-settings-grid-single{grid-template-columns:minmax(300px,1fr)}.settings-panel{padding:22px 24px}.v4-tabs{display:inline-flex;gap:4px;padding:4px;margin:0 0 14px;border:1px solid #e4e1da;border-radius:10px;background:#f7f6f2}.v4-tabs button{height:32px;padding:0 14px;border:0;border-radius:7px;background:transparent;color:#777168;font-size:11px;font-weight:700;cursor:pointer}.v4-tabs button.active{background:#fff;color:#25241f;box-shadow:0 1px 4px rgba(40,36,30,.08)}.settings-panel>p{color:#7d786f;font-size:11px;line-height:1.5}.destination-line input{height:38px}.add-destination{min-height:38px}@media(max-width:1250px){.v4-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.v4-track-row{grid-template-columns:minmax(210px,1.5fr) 115px 105px 95px 90px 150px}}@media(max-width:980px){.v4-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.v4-filters-3{grid-template-columns:1fr 1fr}.v4-track-row{min-width:900px}.v4-log-row{min-width:780px}}
"""
p.write_text(s, encoding='utf-8')


# Tests: optional name fields and full physical workflow.
p = Path('tests/folders-v4.test.mjs')
s = p.read_text(encoding='utf-8')
s = s.replace("'2026_08_12_XX_BET_XX_Travaux_XX_XX'", "'2026_08_12_XX_BET_XX_Travaux__'")
s = s.replace("'2026_08_12_XX_XX_VILLE_Travaux_XX_XX'", "'2026_08_12_XX_XX_VILLE_Travaux__'")
p.write_text(s, encoding='utf-8')

Path('tests/workflow-v4.test.mjs').write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

async function waitFor(url, child) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('server exited');
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('timeout');
}
async function json(url, options={}) {
  const r = await fetch(url, { ...options, headers: options.body ? {'Content-Type':'application/json'} : undefined });
  const body = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(body.error || String(r.status));
  return body;
}

test('échéance=date AO, transfert dédié et dossiers 2/3/4/5', {timeout:25000}, async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'ao-flow-'));
  const data=path.join(root,'data');
  const createRoot=path.join(root,'creation');
  const cet=path.join(root,'CET');
  await fs.mkdir(createRoot,{recursive:true});
  for(const name of ['2 Offres en cours','3 Offre en attente de décision','4 Offre gagnée à sauvegarder','5 Offre perdue']) await fs.mkdir(path.join(cet,name),{recursive:true});
  const port=44500+Math.floor(Math.random()*500);
  const child=spawn(process.execPath,['server.mjs'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe'],env:{...process.env,AO_CREATOR_PORT:String(port),AO_CREATOR_DATA_DIR:data,COMPUTERNAME:'FLOW-PC'}});
  let stderr='';child.stderr.on('data',c=>stderr+=c.toString());
  const base='http://127.0.0.1:'+port;
  try{
    await waitFor(base+'/api/health',child);
    const creation=await json(base+'/api/destinations',{method:'POST',body:JSON.stringify({name:'Entrée',path:createRoot})});
    const transfer=await json(base+'/api/transfer-destinations',{method:'POST',body:JSON.stringify({name:'CET',path:cet})});
    const offer=await json(base+'/api/offers',{method:'POST',body:JSON.stringify({date:'2026-08-12',ca:'XX',be:'BET',client:'',title:'Test',commercial:'',quoteNumber:'',contact:'',destinationId:creation.id})});
    assert.equal(offer.dueDate,'2026-08-12');
    assert.equal(offer.folderName.endsWith('Test__'),true);
    const moved=await json(base+'/api/transfer/execute',{method:'POST',body:JSON.stringify({sourcePath:offer.finalPath,offerUid:offer.uid,date:offer.date,ca:offer.ca,be:offer.be,client:offer.client,title:offer.title,commercial:'',quoteNumber:'',contact:'',destinationId:transfer.id})});
    assert.equal(moved.status,'en_cours');
    assert.equal(path.dirname(moved.finalPath),path.join(cet,'2 Offres en cours'));
    assert.equal(moved.destinationName,'CET');
    assert.equal(moved.dueDate,'2026-08-12');
    const target3=path.join(cet,'3 Offre en attente de décision',moved.folderName);
    await fs.rename(moved.finalPath,target3);
    await json(base+'/api/scan-status',{method:'POST'});
    const after3=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);
    assert.equal(after3.status,'envoye');
    assert.equal(after3.finalPath,target3);
    const target4=path.join(cet,'4 Offre gagnée à sauvegarder',moved.folderName);
    await fs.rename(target3,target4);
    await json(base+'/api/scan-status',{method:'POST'});
    const after4=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);
    assert.equal(after4.status,'gagne');
  }catch(error){throw new Error(error.message+'\n'+stderr);}finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await fs.rm(root,{recursive:true,force:true});}
});
""", encoding='utf-8')

print('v0.4 UX/destination hotfix applied')
