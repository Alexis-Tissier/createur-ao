import React, { useEffect, useMemo, useState } from 'react';

const STATUS = {
  a_attribuer: 'À attribuer',
  en_cours: 'En cours',
  envoye: 'Envoyé',
  gagne: 'Gagné',
  perdu: 'Perdu',
  introuvable: 'Introuvable'
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
  date: today(), ca: 'XX', be: '', client: '', title: '', commercial: '', quoteNumber: '',
  contact: '', price: '', destinationId: ''
});
const emptyTransfer = () => ({
  sourcePath: '', offerUid: '', date: today(), ca: 'XX', be: '', client: '', title: '', commercial: '', quoteNumber: '',
  contact: '', price: '', destinationId: ''
});
function clean(value) { return String(value || '').trim().replace(/_/g, '-'); }
function preview(form) {
  const [y='AAAA',m='MM',d='JJ'] = String(form.date || '').split('-');
  return [y||'AAAA',m||'MM',d||'JJ',clean(form.ca)||'XX',clean(form.be)||'XX',clean(form.client)||'XX',clean(form.title)||'INTITULE',clean(form.commercial),clean(form.quoteNumber)].join('_');
}
function contactHref(value) {
  const text=String(value||'').trim();
  if(!text)return '';
  const url=text.match(/https?:\/\/[^\s,;]+|www\.[^\s,;]+/i)?.[0];
  if(url)return /^https?:\/\//i.test(url)?url:`https://${url}`;
  const email=text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return email?`mailto:${email}`:'';
}
function ContactCellV4({value}){
  const text=String(value||'').trim();
  if(!text)return <span className="muted-cell">—</span>;
  const href=contactHref(text);
  return href?<a className="v4-contact-link" href={href} target="_blank" rel="noreferrer" title={text}>{text}</a>:<span className="v4-contact-text" title={text}>{text}</span>;
}
function rawPriceInput(value){
  const text=String(value??'').trim();
  if(!text)return '';
  const compact=text.replace(/[\u00a0\u202f\s€]/g,'').replace(',','.').replace(/[^0-9.-]/g,'');
  const number=Number(compact);
  if(!Number.isFinite(number)||number<0)return text;
  return Number.isInteger(number)?String(number):String(Math.round(number*100)/100);
}
function formatPriceCurrency(value){
  const raw=rawPriceInput(value);
  const number=Number(raw);
  if(!raw||!Number.isFinite(number))return String(value||'');
  return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2}).format(number);
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
        <Field label="Prix · facultatif"><input value={form.price} onChange={e=>update('price',e.target.value)} placeholder="Ex. 125 000 €"/></Field>
      </div>
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
        title:p.title || '', commercial:p.commercial || '', quoteNumber:p.quoteNumber || '', contact:p.contact || '', price:p.price || '', destinationId:''
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
          <Field label="Prix · facultatif"><input value={form.price} onChange={e=>update('price',e.target.value)} placeholder="Ex. 125 000 €"/></Field>
        </div>
        <div className="folder-preview"><span>Nouveau nom</span><code>{preview(form)}</code></div>
        <div className="create-actions"><button className="primary-button" disabled={busy || !(settings.transferDestinations||[]).length}><Icon name="transfer" size={16}/>{busy?'Transfert…':'Renommer et transférer'}</button></div>
      </>}
    </form>
  </main>;
}

function FollowupModalV4({row,close,reload,toast}){
  const [date,setDate]=useState(today());const [note,setNote]=useState('');const [busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();try{setBusy(true);await api(`/api/offers/${row.uid}/followups`,{method:'POST',body:JSON.stringify({date,note})});await reload();toast({message:'Relance enregistrée.'});close();}catch(error){toast({type:'error',message:error.message});}finally{setBusy(false);}}
  return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><form className="modal" onSubmit={submit}><header><div><span className="eyebrow">Relance</span><h2>{row.title}</h2></div><button type="button" className="icon-button" onClick={close}>×</button></header><Field label="Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field><Field label="Compte rendu"><textarea rows="4" value={note} onChange={e=>setNote(e.target.value)} placeholder="Appel, mail, retour client…"/></Field><footer><button type="button" className="secondary-button" onClick={close}>Annuler</button><button className="primary-button" disabled={busy}>{busy?'Enregistrement…':'Enregistrer'}</button></footer></form></div>;
}

function PriceCellV4({row,reload,toast}){
  const [value,setValue]=useState(row.price||'');const [busy,setBusy]=useState(false);const [editing,setEditing]=useState(false);
  useEffect(()=>{if(!editing)setValue(row.price||'');},[row.uid,row.price,editing]);
  async function save(){
    const next=rawPriceInput(value);
    setEditing(false);
    if(next===String(row.price||'').trim()){setValue(row.price||'');return;}
    try{setBusy(true);await api(`/api/offers/${row.uid}`,{method:'PATCH',body:JSON.stringify({price:next})});await reload();toast({message:'Prix enregistré.'});}
    catch(error){setValue(row.price||'');toast({type:'error',message:error.message});}
    finally{setBusy(false);}
  }
  return <input className="v4-price-input" inputMode="decimal" value={editing?value:formatPriceCurrency(value)} disabled={busy} onFocus={()=>{setEditing(true);setValue(row.price||'');}} onChange={e=>setValue(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} placeholder="—" title="Affichage en euros · PRIX.txt contient uniquement le nombre brut"/>;
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
  const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);const [scanning,setScanning]=useState(false);
  const rows=useMemo(()=>offers.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');const okQ=!q||[r.folderName,r.title,r.client,r.be,r.ca,r.contact,r.price,r.destinationName,r.createdByName,r.lastActorName].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q));return okQ&&(!status||r.status===status)&&(!destination||r.destinationName===destination);}),[offers,query,status,destination]);
  const destinations=[...new Set(offers.map(x=>x.destinationName).filter(Boolean))].sort();
  async function scan(){
    if(scanning)return;
    try{
      setScanning(true);
      const r=await api('/api/scan-status',{method:'POST'});
      await reload();
      if(r.missing)toast({message:`${r.missing} dossier(s) introuvable(s) détecté(s).`});
      else if(r.changed)toast({message:`${r.changed} changement(s) détecté(s)${r.prices?` · ${r.prices} prix mis à jour`:''}.`});
      else toast({message:'Scan terminé · aucun changement détecté.'});
    }catch(error){toast({type:'error',message:error.message});}
    finally{setScanning(false);}
  }
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Pilotage</span><h1>Suivi des AO</h1></div><button type="button" className="secondary-button" onClick={scan} disabled={scanning}><Icon name="refresh" size={15}/>{scanning?'Scan en cours…':'Scanner les emplacements'}</button></header><div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><select value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Toutes les destinations</option>{destinations.map(d=><option key={d}>{d}</option>)}</select></div><section className="v4-table-card"><div className="v4-track-row head"><span>AO</span><span>Client / BE</span><span>Contact</span><span>Prix</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Suivi</span></div>{!rows.length?<div className="empty-state"><strong>Aucun AO</strong></div>:rows.map(row=><TrackingRowV4 key={row.uid} row={row} reload={reload} toast={toast} followup={()=>setFollowup(row)}/>)}</section>{followup&&<FollowupModalV4 row={followup} close={()=>setFollowup(null)} reload={reload} toast={toast}/>}</main>;
}

function LogsPage({ toast }) {
  const [logs,setLogs] = useState([]); const [actors,setActors] = useState([]); const [query,setQuery]=useState(''); const [actor,setActor]=useState(''); const [status,setStatus]=useState('');
  async function load(){try{const [l,a]=await Promise.all([api('/api/logs'),api('/api/actors')]);setLogs(l);setActors(a);}catch(error){toast({type:'error',message:error.message});}}
  useEffect(()=>{load();},[]);
  const rows=logs.filter(r=>{const q=query.trim().toLocaleLowerCase('fr');return (!q || [r.offerTitle,r.action,r.details,r.actorName,r.actorPcId].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))) && (!actor||r.actorPcId===actor) && (!status||r.status===status);});
  return <main className="content history-page v4-compact-page"><header className="page-title history-title"><div><span className="eyebrow">Journal commun</span><h1>Historique</h1></div><button className="secondary-button" onClick={load}><Icon name="refresh" size={15}/>Actualiser</button></header>
    <div className="v4-filters v4-filters-3"><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher"/></label><select value={actor} onChange={e=>setActor(e.target.value)}><option value="">Toutes les personnes</option>{actors.map(a=><option key={a.pcId} value={a.pcId}>{a.displayName || a.pcId}</option>)}</select><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
    <section className="v4-table-card"><div className="v4-log-row head"><span>Date</span><span>Personne</span><span>AO</span><span>Action</span><span>Statut</span></div>{rows.map(r=><div className="v4-log-row" key={r.eventId}><span>{new Date(r.createdAt).toLocaleString('fr-FR')}</span><span><strong>{r.actorName}</strong><small>{r.actorPcId}</small></span><span>{r.offerTitle || '—'}</span><span><strong>{r.action}</strong><small>{r.details}</small></span><span>{STATUS[r.status] || r.status || '—'}</span></div>)}</section>
  </main>;
}

function PathPickerV4({ value, onChange, browse }) {
  return <div className="path-picker"><input value={value} onChange={e=>onChange(e.target.value)} placeholder="Chemin du dossier"/><button type="button" onClick={browse} title="Choisir un dossier"><Icon name="folder" size={16}/></button></div>;
}

function DestinationEditorV4({ destinations, reload, toast, mode='creation' }) {
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
  return <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Emplacements</span><h2>Destinations</h2></div></header><div className="v4-destination-switch"><button type="button" className={tab==='creation'?'active':''} onClick={()=>setTab('creation')}><span className="v4-switch-icon"><Icon name="create" size={18}/></span><span><strong>Création</strong><small>Où les nouveaux AO sont créés</small></span></button><button type="button" className={tab==='transfer'?'active':''} onClick={()=>setTab('transfer')}><span className="v4-switch-icon"><Icon name="transfer" size={18}/></span><span><strong>Transfert</strong><small>Services et dossiers 2 / 3 / 4 / 5</small></span></button></div>{tab==='creation'?<><p>Emplacements proposés lorsque l’AO est créé pour la première fois.</p><DestinationEditorV4 mode="creation" destinations={settings.destinations||[]} reload={reload} toast={toast}/></>:<><p>Un chemin correspond à la racine d’un service (CET, CES…). Le transfert place automatiquement l’AO dans le sous-dossier commençant par <strong>2 </strong>. Les statuts sont ensuite détectés avec les dossiers <strong>2 / 3 / 4 / 5</strong>, quel que soit le texte après le numéro.</p><DestinationEditorV4 mode="transfer" destinations={settings.transferDestinations||[]} reload={reload} toast={toast}/></>}</section>;
}

function mapTreeV4(nodes,id,fn){return nodes.map(n=>n.id===id?fn(n):{...n,children:mapTreeV4(n.children||[],id,fn)});}
function removeTreeV4(nodes,id){return nodes.filter(n=>n.id!==id).map(n=>({...n,children:removeTreeV4(n.children||[],id)}));}
const newTreeNodeV4=()=>({id:`node-${Date.now()}-${Math.random().toString(16).slice(2)}`,name:'Nouveau dossier',children:[]});
function TreeNodeV4({node,rename,add,remove}){return <div className="tree-branch"><div className="tree-node"><div className="tree-folder-box"><span><Icon name="folder" size={15}/></span><input value={node.name} onChange={e=>rename(node.id,e.target.value)}/></div><button className="tree-mini" onClick={()=>remove(node.id)} title="Supprimer"><Icon name="trash" size={14}/></button></div><div className="tree-children">{(node.children||[]).map(child=><TreeNodeV4 key={child.id} node={child} rename={rename} add={add} remove={remove}/>)}<button className="tree-add" onClick={()=>add(node.id)}>+ Nouveau sous-dossier</button></div></div>;}
function TreeEditorV4({initialTree,reload,toast}){
  const [tree,setTree]=useState(initialTree||[]);const [busy,setBusy]=useState(false);useEffect(()=>setTree(initialTree||[]),[initialTree]);
  const rename=(id,name)=>setTree(v=>mapTreeV4(v,id,n=>({...n,name})));const add=id=>setTree(v=>mapTreeV4(v,id,n=>({...n,children:[...(n.children||[]),newTreeNodeV4()]})));const remove=id=>setTree(v=>removeTreeV4(v,id));
  async function save(){try{setBusy(true);await api('/api/tree',{method:'PUT',body:JSON.stringify({tree})});await reload();toast({message:'Arborescence enregistrée.'});}catch(error){toast({type:'error',message:error.message});}finally{setBusy(false);}}
  return <section className="settings-panel tree-panel"><header className="panel-title tree-title"><div><span className="eyebrow">Structure</span><h2>Arborescence des nouveaux AO</h2></div><button className="secondary-button" onClick={save} disabled={busy}>{busy?'Enregistrement…':'Enregistrer'}</button></header><div className="tree-root">{tree.map(node=><TreeNodeV4 key={node.id} node={node} rename={rename} add={add} remove={remove}/>)}<button className="tree-add root-add" onClick={()=>setTree(v=>[...v,newTreeNodeV4()])}><Icon name="plus" size={14}/>Dossier racine</button></div></section>;
}

function buildTemplateV4(settings){return {app:'createur-ao',schemaVersion:3,exportedAt:new Date().toISOString(),destinations:(settings.destinations||[]).map(({name,path})=>({name,path})),transferDestinations:(settings.transferDestinations||[]).map(({name,path})=>({name,path})),tree:settings.tree||[]};}
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

function BackupsPanelV4({toast}){
  const [backups,setBackups]=useState([]);const [busy,setBusy]=useState(false);
  async function load(){try{setBackups(await api('/api/backups'));}catch(error){toast({type:'error',message:error.message});}}
  useEffect(()=>{load();},[]);
  async function createNow(){try{setBusy(true);await api('/api/backups',{method:'POST'});await load();toast({message:'Sauvegarde créée.'});}catch(error){toast({type:'error',message:error.message});}finally{setBusy(false);}}
  async function restore(item){
    if(!window.createurAO?.restoreBackup)return toast({type:'error',message:'La restauration est disponible dans l’application Windows.'});
    if(!confirm(`Restaurer la sauvegarde du ${new Date(item.createdAt).toLocaleString('fr-FR')} ?\n\nFermez Créateur d’AO sur les autres postes avant une restauration, afin d’éviter qu’ils écrivent dans la base maître pendant l’opération.`))return;
    try{setBusy(true);await window.createurAO.restoreBackup(item.path);toast({message:'Sauvegarde restaurée. Rechargement…'});}catch(error){toast({type:'error',message:String(error?.message||error)});setBusy(false);}
  }
  const size=n=>n?`${(Number(n)/1024/1024).toFixed(1)} Mo`:'—';
  return <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Sécurité</span><h2>Sauvegardes</h2></div><button type="button" className="secondary-button" onClick={createNow} disabled={busy}><Icon name="refresh" size={15}/>{busy?'Patiente…':'Sauvegarder maintenant'}</button></header><p>Une sauvegarde automatique est créée chaque jour. Les 10 plus récentes sont conservées. Si une base maître est configurée, sa copie est incluse avec la base locale.</p><div className="v4-backup-list">{!backups.length?<div className="v4-backup-empty">Aucune sauvegarde pour le moment.</div>:backups.map(item=><div className="v4-backup-row" key={item.name}><div><strong>{new Date(item.createdAt).toLocaleString('fr-FR')}</strong><small>{item.kind==='daily'?'Automatique':item.kind==='pre-restore'?'Avant restauration':'Manuelle'} · {size(item.databaseSize)}{item.hasMaster?' · base maître incluse':''}</small></div><button type="button" className="secondary-button" onClick={()=>restore(item)} disabled={busy}>Restaurer</button></div>)}</div></section>;
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
  return <main className="content settings-page v4-compact-page"><header className="page-title"><div><span className="eyebrow">Configuration</span><h1>Réglages</h1></div></header>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Multi-postes</span><h2>Base maître</h2></div><button type="button" className="secondary-button" onClick={syncNow}><Icon name="refresh" size={15}/>Synchroniser</button></header><p>Choisis le dossier commun du serveur. L’application y crée automatiquement <code>Createur-AO-Base</code>. Le SQLite reste local : aucun fichier SQLite n’est ouvert directement à travers le réseau.</p><div className="v4-settings-grid v4-settings-grid-single"><Field label="Dossier serveur maître" wide><div className="v4-path"><input value={shared.masterRoot} onChange={e=>setShared({masterRoot:e.target.value})} placeholder="Choisir le dossier commun"/><button type="button" onClick={browse}><Icon name="folder"/></button></div></Field></div><div className="v4-settings-footer"><span>PC : <strong>{settings.peerId}</strong>{sync?.lastSync?` · dernière synchro ${new Date(sync.lastSync).toLocaleTimeString('fr-FR')}`:''}{sync?.error?<em> · {sync.error}</em>:''}</span><button type="button" className="primary-button" onClick={saveShared}>Enregistrer</button></div></section>
    <DestinationSettingsV4 settings={settings} reload={reloadSettings} toast={toast}/>
    <TreeEditorV4 initialTree={settings.tree||[]} reload={reloadSettings} toast={toast}/>
    <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Identification</span><h2>Personnes</h2></div><Icon name="users"/></header><p>Le nom affiché est modifiable directement ci-dessous. Le PC courant est mis en évidence.</p><div className="v4-actor-list">{actors.map(a=><div className={`v4-actor-row ${a.pcId===settings.peerId?'current':''}`} key={a.pcId}><div className="v4-actor-id"><code>{a.pcId}</code>{a.pcId===settings.peerId&&<span>Ce PC</span>}</div><input type="text" autoComplete="off" value={actorDrafts[a.pcId]??''} onChange={e=>setActorDrafts(v=>({...v,[a.pcId]:e.target.value}))} placeholder="Nom de la personne"/><button type="button" className="secondary-button" onClick={()=>saveActor(a)}>Enregistrer</button></div>)}</div></section>
    <BackupsPanelV4 toast={toast}/>
    <BootstrapPanelV4 settings={settings} reload={reloadSettings} toast={toast}/>
  </main>;
}

export default function AppV4() {
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
