import React, { useEffect, useMemo, useState } from 'react';

const STATUS = {
  a_attribuer: 'À attribuer',
  en_cours: 'En cours',
  envoye: 'Envoyé',
  gagne: 'Gagné',
  perdu: 'Perdu'
};

function Icon({ name, size = 18 }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14"/>,
    folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/>,
    create: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M12 10v6M9 13h6"/></>,
    transfer: <><path d="M4 7h11M12 4l3 3-3 3"/><path d="M20 17H9M12 14l-3 3 3 3"/></>,
    track: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3A1.7 1.7 0 0 0 14 21h-4a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14v-4a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3h4a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9A1.7 1.7 0 0 0 21 10v4a1.7 1.7 0 0 0-1.6 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/></>,
    refresh: <><path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M6.1 9A7 7 0 0 1 18 6l2 5M4 13l2 5a7 7 0 0 0 11.9-3"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5"/><path d="M16 5a3 3 0 0 1 0 6M17 14c2.5.4 4 2 4 5"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Erreur ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyOffer = () => ({
  date: today(), ca: 'XX', be: '', client: '', title: '', commercial: 'XX', quoteNumber: 'XX',
  contact: '', destinationId: '', department: '', dueDate: ''
});
const emptyTransfer = () => ({
  sourcePath: '', offerUid: '', date: today(), ca: 'XX', be: '', client: '', title: '', commercial: 'XX', quoteNumber: 'XX',
  contact: '', destinationId: '', department: '', dueDate: ''
});
function clean(value) { return String(value || '').trim().replace(/_/g, '-'); }
function preview(form) {
  const [y='AAAA',m='MM',d='JJ'] = String(form.date || '').split('-');
  return [y||'AAAA',m||'MM',d||'JJ',clean(form.ca)||'XX',clean(form.be)||'XX',clean(form.client)||'XX',clean(form.title)||'INTITULE',clean(form.commercial)||'XX',clean(form.quoteNumber)||'XX'].join('_');
}
function Field({ label, children, wide = false }) { return <label className={`v4-field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>; }
function Toast({ value, close }) {
  useEffect(() => { if (!value) return; const t = setTimeout(close, 3600); return () => clearTimeout(t); }, [value, close]);
  return value ? <div className={`v4-toast ${value.type || ''}`}>{value.message}</div> : null;
}

function Sidebar({ active, setActive }) {
  const items = [
    ['create','create','Créer'],
    ['transfer','transfer','Transférer'],
    ['tracking','track','Suivi AO'],
    ['history','history','Historique']
  ];
  return <aside className="sidebar">
    <button className="brand" onClick={() => setActive('create')}><span className="brand-mark">C</span><span className="brand-name">Créateur d’AO</span></button>
    <nav>{items.map(([key,icon,label]) => <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}><Icon name={icon}/><span>{label}</span></button>)}</nav>
    <button className={`settings-link ${active === 'settings' ? 'active' : ''}`} onClick={() => setActive('settings')}><Icon name="settings"/><span>Réglages</span></button>
  </aside>;
}

function CreatePage({ settings, reload, toast }) {
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
  return <main className="content">
    <header className="page-title"><div><span className="eyebrow">Nouveau dossier</span><h1>Créer un appel d’offres</h1></div></header>
    <form className="create-card" onSubmit={submit}>
      <div className="v4-grid">
        <Field label="Date"><input type="date" required value={form.date} onChange={e=>update('date',e.target.value)}/></Field>
        <Field label="Chargé d’affaires · CA"><input required value={form.ca} onChange={e=>update('ca',e.target.value.toUpperCase())}/></Field>
        <Field label="Bureau d’étude · BE"><input value={form.be} onChange={e=>update('be',e.target.value.toUpperCase())} placeholder="BE ou laisser vide si Client"/></Field>
        <Field label="Client"><input value={form.client} onChange={e=>update('client',e.target.value.toUpperCase())} placeholder="Client ou laisser vide si BE"/></Field>
        <Field label="Intitulé" wide><input required value={form.title} onChange={e=>update('title',e.target.value)} placeholder="Restructuration du bâtiment"/></Field>
        <Field label="Commercial"><input value={form.commercial} onChange={e=>update('commercial',e.target.value.toUpperCase())}/></Field>
        <Field label="N° devis Onaya"><input value={form.quoteNumber} onChange={e=>update('quoteNumber',e.target.value.toUpperCase())}/></Field>
        <Field label="Destination"><select required value={form.destinationId} onChange={e=>update('destinationId',e.target.value)}><option value="">Choisir</option>{settings.destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Département"><input list="departments" value={form.department} onChange={e=>update('department',e.target.value)} placeholder="CET, CES…"/></Field>
        <Field label="Date limite"><input type="date" value={form.dueDate} onChange={e=>update('dueDate',e.target.value)}/></Field>
        <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)} placeholder="Nom, mail, téléphone…"/></Field>
      </div>
      <datalist id="departments">{settings.destinations.map(d=><option key={d.id} value={d.name}/>)}</datalist>
      <div className="folder-preview"><span>Nom généré</span><code>{preview(form)}</code></div>
      <div className="create-actions"><button className="primary-button" disabled={busy || !settings.destinations.length}><Icon name="create" size={16}/>{busy?'Création…':'Créer le dossier'}</button></div>
    </form>
  </main>;
}

function TransferPage({ settings, reload, toast }) {
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
        title:p.title || '', commercial:p.commercial || 'XX', quoteNumber:p.quoteNumber || 'XX', contact:p.contact || '', destinationId:'',
        department:p.department || '', dueDate:p.dueDate || ''
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
  return <main className="content">
    <header className="page-title"><div><span className="eyebrow">Attribution</span><h1>Transférer un appel d’offres</h1></div></header>
    <form className="create-card" onSubmit={submit}>
      <button type="button" className="v4-folder-picker" onClick={choose}><Icon name="folder"/><span><strong>{form.sourcePath ? 'Dossier sélectionné' : 'Sélectionner le dossier AO'}</strong><small>{form.sourcePath || 'Sélecteur de dossier Windows'}</small></span></button>
      {form.sourcePath && <>
        <div className="v4-grid v4-transfer-grid">
          <Field label="Date"><input type="date" required value={form.date} onChange={e=>update('date',e.target.value)}/></Field>
          <Field label="CA"><input required value={form.ca} onChange={e=>update('ca',e.target.value.toUpperCase())}/></Field>
          <Field label="BE"><input value={form.be} onChange={e=>update('be',e.target.value.toUpperCase())}/></Field>
          <Field label="Client"><input value={form.client} onChange={e=>update('client',e.target.value.toUpperCase())}/></Field>
          <Field label="Intitulé" wide><input required value={form.title} onChange={e=>update('title',e.target.value)}/></Field>
          <Field label="Commercial"><input value={form.commercial} onChange={e=>update('commercial',e.target.value.toUpperCase())}/></Field>
          <Field label="N° devis"><input value={form.quoteNumber} onChange={e=>update('quoteNumber',e.target.value.toUpperCase())}/></Field>
          <Field label="Nouvelle destination"><select required value={form.destinationId} onChange={e=>{const d=settings.destinations.find(x=>String(x.id)===e.target.value);update('destinationId',e.target.value);if(!form.department&&d)update('department',d.name);}}><option value="">Choisir</option>{settings.destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Département"><input value={form.department} onChange={e=>update('department',e.target.value)} placeholder="CET, CES…"/></Field>
          <Field label="Date limite"><input type="date" value={form.dueDate} onChange={e=>update('dueDate',e.target.value)}/></Field>
          <Field label="Contact" wide><input value={form.contact} onChange={e=>update('contact',e.target.value)}/></Field>
        </div>
        <div className="folder-preview"><span>Nouveau nom</span><code>{preview(form)}</code></div>
        <div className="create-actions"><button className="primary-button" disabled={busy}><Icon name="transfer" size={16}/>{busy?'Transfert…':'Renommer et transférer'}</button></div>
      </>}
    </form>
  </main>;
}

function TrackingPage({ offers, settings, reload, toast }) {
  const [query,setQuery] = useState('');
  const [status,setStatus] = useState('');
  const [department,setDepartment] = useState('');
  const rows = useMemo(() => offers.filter(r => {
    const q=query.trim().toLocaleLowerCase('fr');
    const okQ=!q || [r.folderName,r.title,r.client,r.be,r.ca,r.department,r.createdByName,r.lastActorName].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q));
    return okQ && (!status || r.status===status) && (!department || r.department===department);
  }),[offers,query,status,department]);
  const departments=[...new Set(offers.map(x=>x.department).filter(Boolean))].sort();
  async function patch(row, fields) {
    try { await api(`/api/offers/${row.uid}`,{method:'PATCH',body:JSON.stringify(fields)}); await reload(); }
    catch(error){toast({type:'error',message:error.message});}
  }
  async function scan(){try{const r=await api('/api/scan-status',{method:'POST'});await reload();toast({message:r.changed?`${r.changed} statut(s) détecté(s).`:'Aucun changement détecté.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className="content history-page">
    <header className="page-title history-title"><div><span className="eyebrow">Pilotage</span><h1>Suivi des AO</h1></div><button className="secondary-button" onClick={scan}><Icon name="refresh" size={15}/>Scanner Gagnés / Perdus</button></header>
    <div className="v4-filters"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Tous les départements</option>{departments.map(d=><option key={d}>{d}</option>)}</select></div>
    <section className="v4-table-card">
      <div className="v4-track-row head"><span>AO</span><span>Client / BE</span><span>Département</span><span>Statut</span><span>Échéance</span><span>Dernière action</span></div>
      {!rows.length ? <div className="empty-state"><strong>Aucun AO</strong></div> : rows.map(row=><div className="v4-track-row" key={row.uid}>
        <div className="offer-cell"><strong>{row.title}</strong><code>{row.folderName}</code></div>
        <div className="muted-cell">{row.client || row.be || '—'}</div>
        <input value={row.department || ''} onChange={e=>{row.department=e.target.value;reload&&void 0;}} onBlur={e=>patch(row,{department:e.target.value.trim()})} placeholder="Département"/>
        <select className={`status-select ${row.status}`} value={row.status} onChange={e=>patch(row,{status:e.target.value})}>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <input type="date" value={row.dueDate || ''} onChange={e=>patch(row,{dueDate:e.target.value})}/>
        <div className="muted-cell"><strong>{row.lastActorName || row.lastActorPc || '—'}</strong><small>{row.updatedAt ? new Date(row.updatedAt).toLocaleString('fr-FR') : ''}</small></div>
      </div>)}
    </section>
  </main>;
}

function LogsPage({ toast }) {
  const [logs,setLogs] = useState([]); const [actors,setActors] = useState([]); const [query,setQuery]=useState(''); const [actor,setActor]=useState(''); const [department,setDepartment]=useState(''); const [status,setStatus]=useState('');
  async function load(){try{const [l,a]=await Promise.all([api('/api/logs'),api('/api/actors')]);setLogs(l);setActors(a);}catch(error){toast({type:'error',message:error.message});}}
  useEffect(()=>{load();},[]);
  const departments=[...new Set(logs.map(x=>x.department).filter(Boolean))].sort();
  const rows=logs.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');return (!q || [r.offerTitle,r.action,r.details,r.actorName,r.actorPcId].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))) && (!actor||r.actorPcId===actor) && (!department||r.department===department) && (!status||r.status===status);});
  return <main className="content history-page"><header className="page-title history-title"><div><span className="eyebrow">Journal commun</span><h1>Historique</h1></div><button className="secondary-button" onClick={load}><Icon name="refresh" size={15}/>Actualiser</button></header>
    <div className="v4-filters"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={actor} onChange={e=>setActor(e.target.value)}><option value="">Toutes les personnes</option>{actors.map(a=><option key={a.pcId} value={a.pcId}>{a.displayName || a.pcId}</option>)}</select><select value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Tous les départements</option>{departments.map(d=><option key={d}>{d}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <section className="v4-table-card"><div className="v4-log-row head"><span>Date</span><span>Personne</span><span>AO</span><span>Action</span><span>Département</span><span>Statut</span></div>{rows.map(r=><div className="v4-log-row" key={r.eventId}><span>{new Date(r.createdAt).toLocaleString('fr-FR')}</span><span><strong>{r.actorName}</strong><small>{r.actorPcId}</small></span><span>{r.offerTitle || '—'}</span><span><strong>{r.action}</strong><small>{r.details}</small></span><span>{r.department || '—'}</span><span>{STATUS[r.status] || r.status || '—'}</span></div>)}</section>
  </main>;
}

function PathPickerV4({ value, onChange, browse }) {
  return <div className="path-picker"><input value={value} onChange={e=>onChange(e.target.value)} placeholder="Chemin du dossier"/><button type="button" onClick={browse} title="Choisir un dossier"><Icon name="folder" size={16}/></button></div>;
}

function DestinationEditorV4({ destinations, reload, toast }) {
  const [drafts,setDrafts]=useState({});
  const [fresh,setFresh]=useState({name:'',path:''});
  useEffect(()=>setDrafts(Object.fromEntries(destinations.map(d=>[d.id,{name:d.name,path:d.path}]))),[destinations]);
  async function choose(key){
    if(!window.createurAO?.chooseFolder)return toast({type:'error',message:'Le sélecteur natif est disponible dans l’application Windows.'});
    const initial=key==='new'?fresh.path:(drafts[key]?.path||'');
    try{const selected=await window.createurAO.chooseFolder(initial);if(!selected)return;if(key==='new')setFresh(v=>({...v,path:selected}));else setDrafts(v=>({...v,[key]:{...v[key],path:selected}}));}
    catch(error){toast({type:'error',message:String(error?.message||error)});}
  }
  async function add(){try{await api('/api/destinations',{method:'POST',body:JSON.stringify(fresh)});setFresh({name:'',path:''});await reload();toast({message:'Destination ajoutée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function save(id){try{await api(`/api/destinations/${id}`,{method:'PUT',body:JSON.stringify(drafts[id])});await reload();toast({message:'Destination enregistrée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function remove(id){if(!confirm('Supprimer cette destination des réglages ?'))return;try{await api(`/api/destinations/${id}`,{method:'DELETE'});await reload();}catch(error){toast({type:'error',message:error.message});}}
  return <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Emplacements</span><h2>Destinations / départements</h2></div></header><p>Une personne peut créer ou transférer un AO vers n’importe quelle destination. Aucun droit n’est lié au département.</p><div className="destination-list">
    {destinations.map(d=><div className="destination-line" key={d.id}><input value={drafts[d.id]?.name??''} onChange={e=>setDrafts(v=>({...v,[d.id]:{...v[d.id],name:e.target.value}}))} placeholder="Nom"/><PathPickerV4 value={drafts[d.id]?.path??''} onChange={p=>setDrafts(v=>({...v,[d.id]:{...v[d.id],path:p}}))} browse={()=>choose(d.id)}/><button className="save-icon" onClick={()=>save(d.id)} title="Enregistrer"><span>✓</span></button><button className="danger-icon" onClick={()=>remove(d.id)} title="Supprimer"><Icon name="trash" size={15}/></button></div>)}
    <div className="destination-line new-line"><input value={fresh.name} onChange={e=>setFresh(v=>({...v,name:e.target.value}))} placeholder="Nom (CET, CES…)"/><PathPickerV4 value={fresh.path} onChange={p=>setFresh(v=>({...v,path:p}))} browse={()=>choose('new')}/><button className="add-destination" onClick={add} disabled={!fresh.name.trim()||!fresh.path.trim()}><Icon name="plus" size={15}/>Ajouter</button></div>
  </div></section>;
}

function mapTreeV4(nodes,id,fn){return nodes.map(n=>n.id===id?fn(n):{...n,children:mapTreeV4(n.children||[],id,fn)});}
function removeTreeV4(nodes,id){return nodes.filter(n=>n.id!==id).map(n=>({...n,children:removeTreeV4(n.children||[],id)}));}
const newTreeNodeV4=()=>({id:`node-${Date.now()}-${Math.random().toString(16).slice(2)}`,name:'Nouveau dossier',children:[]});
function TreeNodeV4({node,rename,add,remove}){return <div className="tree-branch"><div className="tree-node"><div className="tree-folder-box"><span><Icon name="folder" size={15}/></span><input value={node.name} onChange={e=>rename(node.id,e.target.value)}/></div><button className="tree-mini" onClick={()=>remove(node.id)} title="Supprimer"><Icon name="trash" size={14}/></button></div><div className="tree-children">{(node.children||[]).map(child=><TreeNodeV4 key={child.id} node={child} rename={rename} add={add} remove={remove}/>)}<button className="tree-add" onClick={()=>add(node.id)}>+ Nouveau sous-dossier</button></div></div>;}
function TreeEditorV4({initialTree,reload,toast}){
  const [tree,setTree]=useState(initialTree||[]);const [busy,setBusy]=useState(false);useEffect(()=>setTree(initialTree||[]),[initialTree]);
  const rename=(id,name)=>setTree(v=>mapTreeV4(v,id,n=>({...n,name})));const add=id=>setTree(v=>mapTreeV4(v,id,n=>({...n,children:[...(n.children||[]),newTreeNodeV4()]})));const remove=id=>setTree(v=>removeTreeV4(v,id));
  async function save(){try{setBusy(true);await api('/api/tree',{method:'PUT',body:JSON.stringify({tree})});await reload();toast({message:'Arborescence enregistrée.'});}catch(error){toast({type:'error',message:error.message});}finally{setBusy(false);}}
  return <section className="settings-panel tree-panel"><header className="panel-title tree-title"><div><span className="eyebrow">Structure</span><h2>Arborescence des nouveaux AO</h2></div><button className="secondary-button" onClick={save} disabled={busy}>{busy?'Enregistrement…':'Enregistrer'}</button></header><p className="tree-help">Cette fonction v0.3 est conservée : les sous-dossiers configurés sont créés avec chaque nouvel AO.</p><div className="tree-root">{tree.map(node=><TreeNodeV4 key={node.id} node={node} rename={rename} add={add} remove={remove}/>)}<button className="tree-add root-add" onClick={()=>setTree(v=>[...v,newTreeNodeV4()])}><Icon name="plus" size={14}/>Dossier racine</button></div></section>;
}

function buildTemplateV4(settings){return {app:'createur-ao',schemaVersion:2,exportedAt:new Date().toISOString(),destinations:(settings.destinations||[]).map(({name,path})=>({name,path})),tree:settings.tree||[]};}
function BootstrapPanelV4({settings,reload,toast}){
  const [busy,setBusy]=useState(false);
  async function save(){if(!window.createurAO?.saveConfigFile)return toast({type:'error',message:'Cette fonction est disponible dans l’application Windows.'});if(!settings.destinations?.length)return toast({type:'error',message:'Ajoutez au moins une destination.'});try{setBusy(true);const p=await window.createurAO.saveConfigFile(`${JSON.stringify(buildTemplateV4(settings),null,2)}\n`);if(p)toast({message:'Modèle de démarrage enregistré.'});}catch(error){toast({type:'error',message:String(error?.message||error)});}finally{setBusy(false);}}
  async function load(){if(!window.createurAO?.chooseConfigFile)return toast({type:'error',message:'Cette fonction est disponible dans l’application Windows.'});try{setBusy(true);const result=await window.createurAO.chooseConfigFile();if(!result)return;const template=JSON.parse(result.content);await api('/api/bootstrap/import',{method:'POST',body:JSON.stringify({template,sourcePath:result.path})});await reload();toast({message:'Modèle importé.'});}catch(error){toast({type:'error',message:`Import impossible : ${String(error?.message||error)}`});}finally{setBusy(false);}}
  return <section className="settings-panel bootstrap-panel"><header className="panel-title"><div><span className="eyebrow">Déploiement</span><h2>Modèle de démarrage</h2></div><div className="v4-panel-actions"><button className="secondary-button" onClick={load} disabled={busy}>Importer</button><button className="secondary-button" onClick={save} disabled={busy}>{busy?'Patiente…':'Enregistrer le modèle'}</button></div></header><p>Destinations et arborescence restent exportables/importables pour préparer rapidement un nouveau poste.</p></section>;
}

function FirstRunV4({reload,manual,toast}){
  const [selected,setSelected]=useState(null);const [busy,setBusy]=useState(false);
  async function choose(){if(!window.createurAO?.chooseConfigFile)return manual();try{setBusy(true);const r=await window.createurAO.chooseConfigFile();if(!r)return;setSelected({path:r.path,template:JSON.parse(r.content)});}catch(error){toast({type:'error',message:String(error?.message||error)});}finally{setBusy(false);}}
  async function run(){if(!selected)return;try{setBusy(true);await api('/api/bootstrap/import',{method:'POST',body:JSON.stringify({template:selected.template,sourcePath:selected.path})});await reload();toast({message:'Configuration initiale importée.'});}catch(error){toast({type:'error',message:error.message});}finally{setBusy(false);}}
  async function skip(){try{await api('/api/bootstrap/skip',{method:'POST'});await manual();}catch(error){toast({type:'error',message:error.message});}}
  return <div className="overlay first-run-overlay"><section className="modal first-run-modal"><header><div><span className="eyebrow">Premier lancement</span><h2>Initialiser Créateur d’AO</h2></div></header><p>Tu peux reprendre un modèle existant ou configurer manuellement le poste. La base maître commune se règle ensuite dans Réglages.</p><button className="config-file-button" onClick={choose} disabled={busy}><Icon name="folder"/><span><strong>{selected?'Modèle sélectionné':'Choisir le fichier de configuration'}</strong><small>{selected?.path||'Destinations + arborescence'}</small></span></button><footer><button className="secondary-button" onClick={skip}>Configurer manuellement</button><button className="primary-button" onClick={run} disabled={!selected||busy}>Importer et continuer</button></footer></section></div>;
}

function SettingsPage({ settings, reloadSettings, toast }) {
  const [shared,setShared]=useState({masterRoot:settings.masterRoot||'',wonPath:settings.wonPath||'',lostPath:settings.lostPath||''});
  const [actors,setActors]=useState([]);const [sync,setSync]=useState(null);
  useEffect(()=>setShared({masterRoot:settings.masterRoot||'',wonPath:settings.wonPath||'',lostPath:settings.lostPath||''}),[settings.masterRoot,settings.wonPath,settings.lostPath]);
  async function browse(key){if(!window.createurAO?.chooseFolder)return toast({type:'error',message:'Sélecteur disponible dans l’application Windows.'});const p=await window.createurAO.chooseFolder(shared[key]||'');if(p)setShared(v=>({...v,[key]:p}));}
  async function saveShared(){try{await api('/api/settings/shared',{method:'PUT',body:JSON.stringify(shared)});await reloadSettings();toast({message:'Base maître et suivi enregistrés.'});}catch(error){toast({type:'error',message:error.message});}}
  async function syncNow(){try{const r=await api('/api/sync/run',{method:'POST'});setSync(r);toast({type:r.error?'error':'',message:r.error||'Synchronisation terminée.'});}catch(error){toast({type:'error',message:error.message});}}
  async function loadActors(){setActors(await api('/api/actors'));}
  useEffect(()=>{loadActors();api('/api/sync/status').then(setSync).catch(()=>{});},[]);
  async function saveActor(a){try{await api(`/api/actors/${encodeURIComponent(a.pcId)}`,{method:'PUT',body:JSON.stringify({displayName:a.displayName})});await loadActors();toast({message:'Nom enregistré.'});}catch(error){toast({type:'error',message:error.message});}}
  return <main className="content settings-page"><header className="page-title"><div><span className="eyebrow">Configuration</span><h1>Réglages</h1></div></header>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Multi-postes</span><h2>Base maître</h2></div><button className="secondary-button" onClick={syncNow}><Icon name="refresh" size={15}/>Synchroniser</button></header><p>Choisis le dossier commun du serveur. L’application y crée automatiquement <code>Createur-AO-Base</code>. Le SQLite reste local : aucun fichier SQLite n’est ouvert directement à travers le réseau.</p><div className="v4-settings-grid"><Field label="Dossier serveur maître" wide><div className="v4-path"><input value={shared.masterRoot} onChange={e=>setShared(v=>({...v,masterRoot:e.target.value}))} placeholder="Choisir le dossier commun"/><button type="button" onClick={()=>browse('masterRoot')}><Icon name="folder"/></button></div></Field><Field label="Dossier Gagnés"><div className="v4-path"><input value={shared.wonPath} onChange={e=>setShared(v=>({...v,wonPath:e.target.value}))}/><button type="button" onClick={()=>browse('wonPath')}><Icon name="folder"/></button></div></Field><Field label="Dossier Perdus"><div className="v4-path"><input value={shared.lostPath} onChange={e=>setShared(v=>({...v,lostPath:e.target.value}))}/><button type="button" onClick={()=>browse('lostPath')}><Icon name="folder"/></button></div></Field></div><div className="v4-settings-footer"><span>PC : <strong>{settings.peerId}</strong>{sync?.lastSync?` · dernière synchro ${new Date(sync.lastSync).toLocaleTimeString('fr-FR')}`:''}{sync?.error?<em> · {sync.error}</em>:''}</span><button className="primary-button" onClick={saveShared}>Enregistrer</button></div></section>
    <DestinationEditorV4 destinations={settings.destinations||[]} reload={reloadSettings} toast={toast}/>
    <TreeEditorV4 initialTree={settings.tree||[]} reload={reloadSettings} toast={toast}/>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Identification</span><h2>Personnes</h2></div><Icon name="users"/></header><p>Le nom du PC identifie l’auteur. Le nom affiché est modifiable ; aucune personne n’est limitée à un département.</p><div className="v4-actor-list">{actors.map((a,i)=><div key={a.pcId}><code>{a.pcId}</code><input value={a.displayName} onChange={e=>setActors(v=>v.map((x,j)=>j===i?{...x,displayName:e.target.value}:x))} placeholder="Nom de la personne"/><button className="secondary-button" onClick={()=>saveActor(a)}>Enregistrer</button></div>)}</div></section>
    <BootstrapPanelV4 settings={settings} reload={reloadSettings} toast={toast}/>
  </main>;
}

export default function AppV4() {
  const [active,setActive]=useState('create'); const [settings,setSettings]=useState({destinations:[],tree:[],peerId:'',masterRoot:'',wonPath:'',lostPath:''}); const [offers,setOffers]=useState([]); const [toastValue,setToastValue]=useState(null); const [loading,setLoading]=useState(true);
  const toast=(v)=>setToastValue({...v,key:Date.now()});
  async function loadSettings(){setSettings(await api('/api/settings'));}
  async function loadOffers(){setOffers(await api('/api/offers'));}
  async function loadAll(){try{await Promise.all([loadSettings(),loadOffers()]);}catch(error){toast({type:'error',message:error.message});}finally{setLoading(false);}}
  useEffect(()=>{loadAll();const timer=setInterval(()=>{loadOffers();},5000);return()=>clearInterval(timer);},[]);
  let page;
  if (loading) page=<main className="content loading"><span/></main>;
  else if(active==='create') page=<CreatePage settings={settings} reload={loadOffers} toast={toast}/>;
  else if(active==='transfer') page=<TransferPage settings={settings} reload={loadOffers} toast={toast}/>;
  else if(active==='tracking') page=<TrackingPage offers={offers} settings={settings} reload={loadOffers} toast={toast}/>;
  else if(active==='history') page=<LogsPage toast={toast}/>;
  else page=<SettingsPage settings={settings} reloadSettings={loadSettings} toast={toast}/>;
  return <div className="app-shell"><Sidebar active={active} setActive={setActive}/>{page}{!loading&&settings.onboardingComplete===false&&<FirstRunV4 reload={async()=>{await loadSettings();await loadOffers();}} manual={async()=>{await loadSettings();setActive('settings');}} toast={toast}/>}<Toast key={toastValue?.key} value={toastValue} close={()=>setToastValue(null)}/></div>;
}
