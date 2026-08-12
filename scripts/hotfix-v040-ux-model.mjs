import fs from 'node:fs';

function replaceBetween(text, start, end, replacement, label) {
  const i = text.indexOf(start);
  if (i < 0) throw new Error(`Start marker missing: ${label}`);
  const j = text.indexOf(end, i + start.length);
  if (j < 0) throw new Error(`End marker missing: ${label}`);
  return text.slice(0, i) + replacement + text.slice(j);
}
function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Pattern missing: ${label}`);
  return text.replace(from, to);
}

// ---------- Folder naming ----------
{
  const file = 'lib/folders-v4.mjs';
  let s = fs.readFileSync(file, 'utf8');
  s = replaceOnce(s,
`    title,
    commercial || 'XX',
    quoteNumber || 'XX'
`,
`    title,
    commercial,
    quoteNumber
`, 'optional commercial/quote');
  s = replaceOnce(s,
`    const quoteNumber = rest.pop() || 'XX';
    const commercial = rest.pop() || 'XX';
`,
`    const quoteNumber = rest.pop() ?? '';
    const commercial = rest.pop() ?? '';
`, 'parse optional segments');
  fs.writeFileSync(file, s);
}

// ---------- React UI ----------
{
  const file = 'src/AppV4.jsx';
  let s = fs.readFileSync(file, 'utf8');

  s = replaceBetween(s, 'const emptyOffer = () => ({', 'function Field(', `const emptyOffer = () => ({
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
`, 'offer defaults');

  s = replaceBetween(s, 'function CreatePage(', 'function TransferPage(', `function CreatePage({ settings, reload, toast }) {
  const [form,setForm] = useState(emptyOffer());
  const [busy,setBusy] = useState(false);
  const update = (k,v) => setForm((x) => ({...x,[k]:v}));
  async function submit(e) {
    e.preventDefault();
    if (!form.be.trim() && !form.client.trim()) return toast({type:'error',message:'Renseigne le bureau d’étude ou le client.'});
    try {
      setBusy(true);
      const result = await api('/api/offers',{method:'POST',body:JSON.stringify(form)});
      toast({message:\`Dossier créé : \${result.folderName}\`});
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
        <Field label="Commercial · facultatif"><input value={form.commercial} onChange={e=>update('commercial',e.target.value.toUpperCase())} placeholder="Laisser vide si inconnu"/></Field>
        <Field label="N° devis Onaya · facultatif"><input value={form.quoteNumber} onChange={e=>update('quoteNumber',e.target.value.toUpperCase())} placeholder="Laisser vide"/></Field>
        <Field label="Destination de création"><select required value={form.destinationId} onChange={e=>update('destinationId',e.target.value)}><option value="">Choisir</option>{settings.destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="Nom, mail, téléphone…"/></Field>
      </div>
      <div className="folder-preview"><span>Nom généré</span><code>{preview(form)}</code></div>
      <div className="create-actions"><button className="primary-button" disabled={busy || !settings.destinations.length}><Icon name="create" size={16}/>{busy?'Création…':'Créer le dossier'}</button></div>
    </form>
  </main>;
}

`, 'CreatePage');

  s = replaceBetween(s, 'function TransferPage(', 'function FollowupModalV4(', `function TransferPage({ settings, reload, toast }) {
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
      toast({message:\`AO transféré vers \${result.destinationName}.\`}); setForm(emptyTransfer()); await reload();
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

`, 'TransferPage');

  s = replaceBetween(s, 'function TrackingRowV4(', 'function LogsPage(', `function TrackingRowV4({row,followup}){
  return <div className="v4-track-row">
    <div className="offer-cell"><strong>{row.title}</strong><code>{row.folderName}</code></div>
    <div className="muted-cell">{row.client||row.be||'—'}<small>{row.client&&row.be?\`BE : \${row.be}\`:''}</small></div>
    <div className="destination-chip">{row.destinationName||'Création'}</div>
    <div className={\`status-badge \${row.status}\`}>{STATUS[row.status]||row.status}</div>
    <div className="v4-date-cell">{row.date ? new Date(\`${row.date}T12:00:00\`).toLocaleDateString('fr-FR') : '—'}</div>
    <div className="v4-track-actions"><div className="muted-cell"><strong>{row.lastActorName||row.lastActorPc||'—'}</strong><small>{row.updatedAt?new Date(row.updatedAt).toLocaleString('fr-FR'):''}</small></div><button className="small-action" onClick={followup}>Relance</button><small>{row.lastFollowupAt?\`${row.lastFollowupAt} · \${row.followupCount}\`:'Aucune relance'}</small></div>
  </div>;
}

function TrackingPage({ offers, reload, toast }) {
  const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);
  const rows=useMemo(()=>offers.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');const okQ=!q||[r.folderName,r.title,r.client,r.be,r.ca,r.destinationName,r.createdByName,r.lastActorName].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q));return okQ&&(!status||r.status===status)&&(!destination||r.destinationName===destination);}),[offers,query,status,destination]);
  const destinations=[...new Set(offers.map(x=>x.destinationName).filter(Boolean))].sort();
  async function scan(){try{const r=await api('/api/scan-status',{method:'POST'});await reload();toast({message:r.changed?\`${r.changed} statut(s) détecté(s).\`:'Aucun changement détecté.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Pilotage</span><h1>Suivi des AO</h1></div><button className="secondary-button" onClick={scan}><Icon name="refresh" size={15}/>Scanner les emplacements</button></header><div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Toutes les destinations</option>{destinations.map(d=><option key={d}>{d}</option>)}</select></div><section className="v4-table-card"><div className="v4-track-row head"><span>AO</span><span>Client / BE</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Suivi</span></div>{!rows.length?<div className="empty-state"><strong>Aucun AO</strong></div>:rows.map(row=><TrackingRowV4 key={row.uid} row={row} followup={()=>setFollowup(row)}/>)}</section>{followup&&<FollowupModalV4 row={followup} close={()=>setFollowup(null)} reload={reload} toast={toast}/>}</main>;
}

`, 'TrackingPage');

  s = replaceBetween(s, 'function LogsPage(', 'function PathPickerV4(', `function LogsPage({ toast }) {
  const [logs,setLogs] = useState([]); const [actors,setActors] = useState([]); const [query,setQuery]=useState(''); const [actor,setActor]=useState(''); const [status,setStatus]=useState('');
  async function load(){try{const [l,a]=await Promise.all([api('/api/logs'),api('/api/actors')]);setLogs(l);setActors(a);}catch(error){toast({type:'error',message:error.message});}}
  useEffect(()=>{load();},[]);
  const rows=logs.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');return (!q || [r.offerTitle,r.action,r.details,r.actorName,r.actorPcId].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))) && (!actor||r.actorPcId===actor) && (!status||r.status===status);});
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Journal commun</span><h1>Historique</h1></div><button className="secondary-button" onClick={load}><Icon name="refresh" size={15}/>Actualiser</button></header>
    <div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={actor} onChange={e=>setActor(e.target.value)}><option value="">Toutes les personnes</option>{actors.map(a=><option key={a.pcId} value={a.pcId}>{a.displayName || a.pcId}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <section className="v4-table-card"><div className="v4-log-row head"><span>Date</span><span>Personne</span><span>AO</span><span>Action</span><span>Statut</span></div>{rows.map(r=><div className="v4-log-row" key={r.eventId}><span>{new Date(r.createdAt).toLocaleString('fr-FR')}</span><span><strong>{r.actorName}</strong><small>{r.actorPcId}</small></span><span>{r.offerTitle || '—'}</span><span><strong>{r.action}</strong><small>{r.details}</small></span><span>{STATUS[r.status] || r.status || '—'}</span></div>)}</section>
  </main>;
}

`, 'LogsPage');

  s = replaceBetween(s, 'function DestinationEditorV4(', 'function mapTreeV4(', `function DestinationEditorV4({ destinations, reload, toast, mode='creation' }) {
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
  async function save(id){try{await api(\`${endpoint}/\${id}\`,{method:'PUT',body:JSON.stringify(drafts[id])});await reload();toast({message:'Destination enregistrée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function remove(id){if(!confirm('Supprimer cette destination des réglages ?'))return;try{await api(\`${endpoint}/\${id}\`,{method:'DELETE'});await reload();}catch(error){toast({type:'error',message:error.message});}}
  return <div className="destination-list">
    {destinations.map(d=><div className="destination-line" key={d.id}><input value={drafts[d.id]?.name??''} onChange={e=>setDrafts(v=>({...v,[d.id]:{...v[d.id],name:e.target.value}}))} placeholder="Nom"/><PathPickerV4 value={drafts[d.id]?.path??''} onChange={p=>setDrafts(v=>({...v,[d.id]:{...v[d.id],path:p}}))} browse={()=>choose(d.id)}/><button className="save-icon" onClick={()=>save(d.id)} title="Enregistrer"><span>✓</span></button><button className="danger-icon" onClick={()=>remove(d.id)} title="Supprimer"><Icon name="trash" size={15}/></button></div>)}
    <div className="destination-line new-line"><input value={fresh.name} onChange={e=>setFresh(v=>({...v,name:e.target.value}))} placeholder={mode==='transfer'?'Nom (CET, CES…)':'Nom de la destination'}/><PathPickerV4 value={fresh.path} onChange={p=>setFresh(v=>({...v,path:p}))} browse={()=>choose('new')}/><button className="add-destination" onClick={add} disabled={!fresh.name.trim()||!fresh.path.trim()}><Icon name="plus" size={15}/>Ajouter</button></div>
  </div>;
}

function DestinationSettingsV4({settings,reload,toast}){
  const [tab,setTab]=useState('creation');
  return <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Emplacements</span><h2>Destinations</h2></div></header><div className="v4-tabs"><button className={tab==='creation'?'active':''} onClick={()=>setTab('creation')}>Création</button><button className={tab==='transfer'?'active':''} onClick={()=>setTab('transfer')}>Transfert</button></div>{tab==='creation'?<><p>Emplacements proposés lorsque l’AO est créé pour la première fois.</p><DestinationEditorV4 mode="creation" destinations={settings.destinations||[]} reload={reload} toast={toast}/></>:<><p>Un chemin correspond à la racine d’un service (CET, CES…). Le transfert place automatiquement l’AO dans le sous-dossier commençant par <strong>2 </strong>. Les statuts sont ensuite détectés avec les dossiers <strong>2 / 3 / 4 / 5</strong>, quel que soit le texte après le numéro.</p><DestinationEditorV4 mode="transfer" destinations={settings.transferDestinations||[]} reload={reload} toast={toast}/></>}</section>;
}

`, 'Destination editors');

  s = replaceOnce(s,
`function buildTemplateV4(settings){return {app:'createur-ao',schemaVersion:2,exportedAt:new Date().toISOString(),destinations:(settings.destinations||[]).map(({name,path})=>({name,path})),tree:settings.tree||[]};}`,
`function buildTemplateV4(settings){return {app:'createur-ao',schemaVersion:3,exportedAt:new Date().toISOString(),destinations:(settings.destinations||[]).map(({name,path})=>({name,path})),transferDestinations:(settings.transferDestinations||[]).map(({name,path})=>({name,path})),tree:settings.tree||[]};}`,
'bootstrap template');

  s = replaceBetween(s, 'function SettingsPage(', 'export default function AppV4()', `function SettingsPage({ settings, reloadSettings, toast }) {
  const [shared,setShared]=useState({masterRoot:settings.masterRoot||''});
  const [actors,setActors]=useState([]);const [sync,setSync]=useState(null);
  useEffect(()=>setShared({masterRoot:settings.masterRoot||''}),[settings.masterRoot]);
  async function browse(){if(!window.createurAO?.chooseFolder)return toast({type:'error',message:'Sélecteur disponible dans l’application Windows.'});const p=await window.createurAO.chooseFolder(shared.masterRoot||'');if(p)setShared({masterRoot:p});}
  async function saveShared(){try{await api('/api/settings/shared',{method:'PUT',body:JSON.stringify(shared)});await reloadSettings();toast({message:'Base maître enregistrée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function syncNow(){try{const r=await api('/api/sync/run',{method:'POST'});setSync(r);toast({type:r.error?'error':'',message:r.error||'Synchronisation terminée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function loadActors(){setActors(await api('/api/actors'));}
  useEffect(()=>{loadActors();api('/api/sync/status').then(setSync).catch(()=>{});},[]);
  async function saveActor(a){try{await api(\`/api/actors/\${encodeURIComponent(a.pcId)}\`,{method:'PUT',body:JSON.stringify({displayName:a.displayName})});await loadActors();toast({message:'Nom enregistré.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className="content settings-page v4-compact-page"><header className="page-title"><div><span className="eyebrow">Configuration</span><h1>Réglages</h1></div></header>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Multi-postes</span><h2>Base maître</h2></div><button className="secondary-button" onClick={syncNow}><Icon name="refresh" size={15}/>Synchroniser</button></header><p>Choisis le dossier commun du serveur. L’application y crée automatiquement <code>Createur-AO-Base</code>. Le SQLite reste local : aucun fichier SQLite n’est ouvert directement à travers le réseau.</p><div className="v4-settings-grid v4-settings-grid-single"><Field label="Dossier serveur maître" wide><div className="v4-path"><input value={shared.masterRoot} onChange={e=>setShared({masterRoot:e.target.value})} placeholder="Choisir le dossier commun"/><button type="button" onClick={browse}><Icon name="folder"/></button></div></Field></div><div className="v4-settings-footer"><span>PC : <strong>{settings.peerId}</strong>{sync?.lastSync?\` · dernière synchro \${new Date(sync.lastSync).toLocaleTimeString('fr-FR')}\`:''}{sync?.error?<em> · {sync.error}</em>:''}</span><button className="primary-button" onClick={saveShared}>Enregistrer</button></div></section>
    <DestinationSettingsV4 settings={settings} reload={reloadSettings} toast={toast}/>
    <TreeEditorV4 initialTree={settings.tree||[]} reload={reloadSettings} toast={toast}/>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Identification</span><h2>Personnes</h2></div><Icon name="users"/></header><p>Le nom du PC identifie l’auteur. Le nom affiché est modifiable.</p><div className="v4-actor-list">{actors.map((a,i)=><div key={a.pcId}><code>{a.pcId}</code><input value={a.displayName} onChange={e=>setActors(v=>v.map((x,j)=>j===i?{...x,displayName:e.target.value}:x))} placeholder="Nom de la personne"/><button className="secondary-button" onClick={()=>saveActor(a)}>Enregistrer</button></div>)}</div></section>
    <BootstrapPanelV4 settings={settings} reload={reloadSettings} toast={toast}/>
  </main>;
}

`, 'SettingsPage');

  s = replaceBetween(s, 'export default function AppV4()', '', ``, 'noop');
  // previous helper cannot replace to EOF with an empty marker; restore through direct slicing.
}
