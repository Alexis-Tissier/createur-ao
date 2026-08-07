import React, { useEffect, useMemo, useRef, useState } from 'react';

function Icon({ name, size = 18 }) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    check: <path d="m20 6-11 11-5-5" />,
    left: <path d="m15 18-6-6 6-6" />,
    right: <path d="m9 18 6-6-6-6" />,
    folder: <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />,
    folderPlus: <><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z"/><path d="M12 10v6M9 13h6" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2" /></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21h-4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14v-4a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3h4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1v4a1.7 1.7 0 0 0-1.6 1Z" /></>,
    calendar: <><path d="M6 3v3M18 3v3M4 8h16"/><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01" /></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" /></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5h4" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    branch: <><path d="M6 4v6a4 4 0 0 0 4 4h8"/><path d="m14 10 4 4-4 4" /></>,
    archive: <><path d="M4 7h16v12H4zM3 4h18v3H3zM9 11h6" /></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({ date: today(), ca: '', be: '', title: '', commercial: '', quoteNumber: '', contact: '', destinationId: '' });

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json', ...(options.headers || {}) } : options.headers
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Erreur ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function clean(value, upper = false) {
  let result = String(value || '').trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/_+/g, '-').replace(/\s+/g, ' ').replace(/[. ]+$/g, '');
  if (upper) result = result.toUpperCase();
  return result;
}

function previewName(form) {
  const [y = 'AAAA', m = 'MM', d = 'JJ'] = String(form.date || '').split('-');
  const com = clean(form.commercial, true);
  const quote = clean(form.quoteNumber, true);
  const name = [y || 'AAAA', m || 'MM', d || 'JJ', clean(form.ca, true) || 'CA', clean(form.be, true) || 'BE', clean(form.title) || 'INTITULE', com, quote].join('_');
  return !com && !quote ? `${name}_` : name;
}

function Toast({ value, close }) {
  useEffect(() => {
    if (!value) return undefined;
    const timer = setTimeout(close, 3600);
    return () => clearTimeout(timer);
  }, [value, close]);
  if (!value) return null;
  return <div className={`toast ${value.type || ''}`}><span><Icon name={value.type === 'error' ? 'close' : 'check'} size={15}/></span><p>{value.message}</p></div>;
}

function Field({ label, children, wide = false }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}</span>{children}</label>;
}

const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const weekdays = ['lu','ma','me','je','ve','sa','di'];
const parseDate = (value) => {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null;
};
const isoDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const sameDay = (a,b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function DatePicker({ value, onChange }) {
  const selected = parseDate(value) || new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(new Date(selected.getFullYear(), selected.getMonth(), 1, 12));
  const ref = useRef(null);
  useEffect(() => {
    const next = parseDate(value);
    if (next) setView(new Date(next.getFullYear(), next.getMonth(), 1, 12));
  }, [value]);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const first = new Date(view.getFullYear(), view.getMonth(), 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(view.getFullYear(), view.getMonth(), 1 - offset, 12);
  const days = Array.from({length: 42}, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));
  const chosen = parseDate(value);
  return <div className="date-picker" ref={ref}>
    <button type="button" className={`date-trigger ${open ? 'open' : ''}`} onClick={() => setOpen(v => !v)}><span>{chosen ? new Intl.DateTimeFormat('fr-FR').format(chosen) : 'Choisir une date'}</span><Icon name="calendar" size={17}/></button>
    {open && <div className="calendar-popover">
      <div className="calendar-head"><strong>{months[view.getMonth()]} {view.getFullYear()}</strong><div><button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth()-1, 1, 12))}><Icon name="left" size={15}/></button><button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth()+1, 1, 12))}><Icon name="right" size={15}/></button></div></div>
      <div className="calendar-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendar-grid">{days.map(day => <button type="button" key={isoDate(day)} className={`${day.getMonth() !== view.getMonth() ? 'outside' : ''} ${sameDay(day,chosen) ? 'selected' : ''}`} onClick={() => { onChange(isoDate(day)); setOpen(false); }}>{day.getDate()}</button>)}</div>
      <button type="button" className="calendar-today" onClick={() => { onChange(today()); setOpen(false); }}>Aujourd’hui</button>
    </div>}
  </div>;
}

function Sidebar({ active, setActive }) {
  return <aside className="sidebar">
    <button className="brand" onClick={() => setActive('create')}><span className="brand-mark">C</span><span className="brand-name">Créateur d’AO</span></button>
    <nav>
      <button className={active === 'create' ? 'active' : ''} onClick={() => setActive('create')}><Icon name="folderPlus"/><span>Créer</span></button>
      <button className={active === 'history' ? 'active' : ''} onClick={() => setActive('history')}><Icon name="history"/><span>Historique</span></button>
    </nav>
    <button className={`settings-link ${active === 'settings' ? 'active' : ''}`} onClick={() => setActive('settings')}><Icon name="settings"/><span>Réglages</span></button>
  </aside>;
}

function CreatePage({ destinations, reload, toast }) {
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const update = (key, value) => setForm(current => ({...current, [key]: value}));
  const preview = useMemo(() => previewName(form), [form]);
  async function submit(e) {
    e.preventDefault();
    try {
      setBusy(true);
      const result = await api('/api/offers', { method:'POST', body: JSON.stringify(form) });
      toast({ message: `Dossier créé : ${result.folderName}` });
      setForm(emptyForm());
      await reload();
    } catch (error) { toast({type:'error', message:error.message}); }
    finally { setBusy(false); }
  }
  return <main className="content">
    <header className="page-title"><div><span className="eyebrow">Nouveau dossier</span><h1>Créer un appel d’offres</h1></div></header>
    {!destinations.length && <div className="notice">Configure d’abord au moins une destination dans Réglages.</div>}
    <form className="create-card" onSubmit={submit}>
      <div className="create-grid">
        <Field label="Date"><DatePicker value={form.date} onChange={v => update('date',v)}/></Field>
        <Field label="Chargé d’affaires · CA"><input required value={form.ca} onChange={e => update('ca',e.target.value.toUpperCase())} placeholder="CA"/></Field>
        <Field label="Bureau d’étude · BE"><input required value={form.be} onChange={e => update('be',e.target.value.toUpperCase())} placeholder="BE"/></Field>
        <Field label="Commercial · facultatif"><input value={form.commercial} onChange={e => update('commercial',e.target.value.toUpperCase())} placeholder="COM"/></Field>
        <Field label="Intitulé" wide><input required value={form.title} onChange={e => update('title',e.target.value)} placeholder="Restructuration du bâtiment"/></Field>
        <Field label="N° devis Onaya · facultatif"><input value={form.quoteNumber} onChange={e => update('quoteNumber',e.target.value)} placeholder="N° devis"/></Field>
        <Field label="Destination"><select required value={form.destinationId} onChange={e => update('destinationId',e.target.value)}><option value="">Choisir</option>{destinations.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Contact" wide><input value={form.contact} onChange={e => update('contact',e.target.value)} placeholder="Nom, mail, téléphone…"/></Field>
      </div>
      <div className="folder-preview"><span>Nom généré</span><code>{preview}</code></div>
      <div className="create-actions"><button className="primary-button" disabled={busy || !destinations.length}><Icon name="folderPlus" size={16}/>{busy ? 'Création…' : 'Créer le dossier'}</button></div>
    </form>
  </main>;
}

function FollowupModal({ row, close, reload, toast }) {
  const [date,setDate] = useState(today());
  const [note,setNote] = useState('');
  const [busy,setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    try { setBusy(true); await api(`/api/offers/${row.id}/followups`, {method:'POST', body:JSON.stringify({date,note})}); await reload(); toast({message:'Relance enregistrée.'}); close(); }
    catch(error) { toast({type:'error',message:error.message}); }
    finally { setBusy(false); }
  }
  return <div className="overlay" onMouseDown={e => e.target === e.currentTarget && close()}><form className="modal" onSubmit={submit}><header><div><span className="eyebrow">Relance</span><h2>{row.title}</h2></div><button type="button" className="icon-button" onClick={close}><Icon name="close"/></button></header><Field label="Date"><DatePicker value={date} onChange={setDate}/></Field><Field label="Remarque"><textarea rows="4" value={note} onChange={e => setNote(e.target.value)} placeholder="Compte rendu…"/></Field><footer><button type="button" className="secondary-button" onClick={close}>Annuler</button><button className="primary-button" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></footer></form></div>;
}

function HistoryPage({ offers, reload, toast }) {
  const [query,setQuery] = useState('');
  const [followup,setFollowup] = useState(null);
  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('fr');
    if (!q) return offers;
    return offers.filter(row => [row.folderName,row.title,row.contact,row.destinationName,row.ca,row.be,row.quoteNumber].some(v => String(v || '').toLocaleLowerCase('fr').includes(q)));
  }, [offers,query]);
  async function saveRemark(row, remark) {
    if (remark === row.remark) return;
    try { await api(`/api/offers/${row.id}`, {method:'PATCH', body:JSON.stringify({remark})}); await reload(); }
    catch(error) { toast({type:'error',message:error.message}); }
  }
  async function remove(row) {
    if (!window.confirm(`Supprimer « ${row.title} » de l’historique ?\n\nLe dossier physique ne sera pas supprimé.`)) return;
    try { await api(`/api/offers/${row.id}`, {method:'DELETE'}); await reload(); toast({message:'Ligne supprimée de l’historique.'}); }
    catch(error) { toast({type:'error',message:error.message}); }
  }
  return <main className="content history-page">
    <header className="page-title history-title"><div><span className="eyebrow">Suivi</span><h1>Historique</h1></div><label className="search-box"><Icon name="search" size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher"/></label></header>
    <section className="history-card">
      <div className="history-row history-head"><span>Appel d’offres</span><span>Contact</span><span>Destination</span><span>Relance</span><span>Remarque</span><span></span></div>
      {!rows.length ? <div className="empty-state"><Icon name="archive" size={24}/><strong>Aucun appel d’offres</strong></div> : rows.map(row => <HistoryRow key={row.id} row={row} saveRemark={saveRemark} followup={() => setFollowup(row)} remove={() => remove(row)}/>) }
    </section>
    {followup && <FollowupModal row={followup} close={() => setFollowup(null)} reload={reload} toast={toast}/>} 
  </main>;
}

function HistoryRow({ row, saveRemark, followup, remove }) {
  const [remark,setRemark] = useState(row.remark || '');
  useEffect(() => setRemark(row.remark || ''), [row.remark]);
  return <div className="history-row">
    <div className="offer-cell"><strong>{row.title}</strong><code>{row.folderName}</code></div>
    <div className="muted-cell">{row.contact || '—'}</div>
    <div><span className="destination-chip">{row.destinationName}</span></div>
    <div className="followup-cell"><button className="small-action" onClick={followup}><Icon name="clock" size={14}/>Relance</button><small>{row.lastFollowupAt ? `${row.lastFollowupAt} · ${row.followupCount}` : 'Aucune'}</small></div>
    <input className="remark-input" value={remark} onChange={e => setRemark(e.target.value)} onBlur={() => saveRemark(row,remark.trim())} placeholder="Ajouter…"/>
    <button className="history-delete" onClick={remove} title="Supprimer de l’historique"><Icon name="trash" size={15}/></button>
  </div>;
}

function PathInput({ value, onChange, browse }) {
  return <div className="path-picker"><input value={value} onChange={e => onChange(e.target.value)} placeholder={String.raw`\\serveur\partage\dossier`}/><button type="button" onClick={browse} title="Choisir un dossier"><Icon name="folder" size={16}/></button></div>;
}

function DestinationEditor({ destinations, reload, toast }) {
  const [drafts,setDrafts] = useState({});
  const [fresh,setFresh] = useState({name:'',path:''});
  useEffect(() => setDrafts(Object.fromEntries(destinations.map(d => [d.id,{name:d.name,path:d.path}]))), [destinations]);
  async function choose(key) {
    if (!window.createurAO?.chooseFolder) return toast({type:'error',message:'Le sélecteur natif est disponible dans l’application Windows.'});
    try {
      const initial = key === 'new' ? fresh.path : drafts[key]?.path || '';
      const selected = await window.createurAO.chooseFolder(initial);
      if (!selected) return;
      if (key === 'new') setFresh(v => ({...v,path:selected})); else setDrafts(v => ({...v,[key]:{...v[key],path:selected}}));
    } catch(error) { toast({type:'error',message:String(error?.message || error)}); }
  }
  async function add() { try { await api('/api/destinations',{method:'POST',body:JSON.stringify(fresh)}); setFresh({name:'',path:''}); await reload(); toast({message:'Destination ajoutée.'}); } catch(error) { toast({type:'error',message:error.message}); } }
  async function save(id) { try { await api(`/api/destinations/${id}`,{method:'PUT',body:JSON.stringify(drafts[id])}); await reload(); toast({message:'Destination enregistrée.'}); } catch(error) { toast({type:'error',message:error.message}); } }
  async function remove(id) { if (!window.confirm('Supprimer cette destination des réglages ?')) return; try { await api(`/api/destinations/${id}`,{method:'DELETE'}); await reload(); } catch(error) { toast({type:'error',message:error.message}); } }
  return <section className="settings-panel"><header className="panel-title"><div><span className="eyebrow">Emplacements</span><h2>Destinations</h2></div></header><div className="destination-list">
    {destinations.map(d => <div className="destination-line" key={d.id}><input value={drafts[d.id]?.name ?? ''} onChange={e => setDrafts(v => ({...v,[d.id]:{...v[d.id],name:e.target.value}}))} placeholder="Nom"/><PathInput value={drafts[d.id]?.path ?? ''} onChange={path => setDrafts(v => ({...v,[d.id]:{...v[d.id],path}}))} browse={() => choose(d.id)}/><button className="save-icon" onClick={() => save(d.id)} title="Enregistrer"><Icon name="check" size={16}/></button><button className="danger-icon" onClick={() => remove(d.id)} title="Supprimer"><Icon name="trash" size={15}/></button></div>)}
    <div className="destination-line new-line"><input value={fresh.name} onChange={e => setFresh(v => ({...v,name:e.target.value}))} placeholder="Nom"/><PathInput value={fresh.path} onChange={path => setFresh(v => ({...v,path}))} browse={() => choose('new')}/><button className="add-destination" onClick={add} disabled={!fresh.name.trim() || !fresh.path.trim()}><Icon name="plus" size={15}/>Ajouter</button></div>
  </div></section>;
}

function mapNode(nodes,id,fn) { return nodes.map(n => n.id === id ? fn(n) : {...n,children:mapNode(n.children || [],id,fn)}); }
function removeNode(nodes,id) { return nodes.filter(n => n.id !== id).map(n => ({...n,children:removeNode(n.children || [],id)})); }
const newNode = () => ({id:`node-${Date.now()}-${Math.random().toString(16).slice(2)}`,name:'Nouveau dossier',children:[]});

function TreeNode({ node, rename, add, remove }) {
  return <div className="tree-branch"><div className="tree-node"><div className="tree-folder-box"><span><Icon name="folder" size={15}/></span><input value={node.name} onChange={e => rename(node.id,e.target.value)}/></div><button className="tree-mini" onClick={() => remove(node.id)} title="Supprimer"><Icon name="trash" size={14}/></button></div><div className="tree-children">{(node.children || []).map(child => <TreeNode key={child.id} node={child} rename={rename} add={add} remove={remove}/>)}<button className="tree-add" onClick={() => add(node.id)}><Icon name="branch" size={13}/>Nouveau sous-dossier</button></div></div>;
}

function TreeEditor({ initialTree, reload, toast }) {
  const [tree,setTree] = useState(initialTree);
  const [busy,setBusy] = useState(false);
  useEffect(() => setTree(initialTree), [initialTree]);
  const rename = (id,name) => setTree(v => mapNode(v,id,n => ({...n,name})));
  const add = id => setTree(v => mapNode(v,id,n => ({...n,children:[...(n.children || []),newNode()]})));
  const remove = id => setTree(v => removeNode(v,id));
  async function save() { try { setBusy(true); await api('/api/tree',{method:'PUT',body:JSON.stringify({tree})}); await reload(); toast({message:'Arborescence enregistrée.'}); } catch(error) { toast({type:'error',message:error.message}); } finally { setBusy(false); } }
  return <section className="settings-panel tree-panel"><header className="panel-title tree-title"><div><span className="eyebrow">Structure</span><h2>Arborescence</h2></div><button className="secondary-button" onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button></header><p className="tree-help"><Icon name="branch" size={14}/>Chaque bouton « Nouveau sous-dossier » ajoute un enfant au bloc situé juste au-dessus.</p><div className="tree-root">{tree.map(node => <TreeNode key={node.id} node={node} rename={rename} add={add} remove={remove}/>)}<button className="tree-add root-add" onClick={() => setTree(v => [...v,newNode()])}><Icon name="plus" size={14}/>Dossier racine</button></div></section>;
}

function buildTemplate(settings) { return {app:'createur-ao',schemaVersion:1,exportedAt:new Date().toISOString(),destinations:(settings.destinations || []).map(({name,path}) => ({name,path})),tree:settings.tree || []}; }

function BootstrapPanel({ settings, toast }) {
  const [busy,setBusy] = useState(false);
  async function save() {
    if (!window.createurAO?.saveConfigFile) return toast({type:'error',message:'Cette fonction est disponible dans l’application Windows.'});
    if (!settings.destinations?.length) return toast({type:'error',message:'Ajoutez au moins une destination avant de créer le modèle.'});
    try { setBusy(true); const path = await window.createurAO.saveConfigFile(`${JSON.stringify(buildTemplate(settings),null,2)}\n`); if (path) toast({message:'Modèle de démarrage enregistré.'}); }
    catch(error) { toast({type:'error',message:String(error?.message || error)}); }
    finally { setBusy(false); }
  }
  return <section className="settings-panel bootstrap-panel"><header className="panel-title"><div><span className="eyebrow">Déploiement</span><h2>Modèle de démarrage</h2></div><button className="secondary-button" onClick={save} disabled={busy}><Icon name="archive" size={15}/>{busy ? 'Enregistrement…' : 'Enregistrer le modèle'}</button></header><p>Enregistre destinations et arborescence dans un JSON sur le serveur. Sur chaque nouveau poste, il est importé une seule fois dans le SQLite local puis n’est plus utilisé.</p></section>;
}

function FirstRun({ imported, manual, toast }) {
  const [selected,setSelected] = useState(null);
  const [busy,setBusy] = useState(false);
  async function choose() {
    if (!window.createurAO?.chooseConfigFile) return toast({type:'error',message:'Lance l’application Windows pour choisir le modèle.'});
    try { setBusy(true); const result = await window.createurAO.chooseConfigFile(); if (!result) return; const template = JSON.parse(result.content); if (template?.app && template.app !== 'createur-ao') throw new Error('Ce fichier ne correspond pas à Créateur d’AO.'); setSelected({path:result.path,template}); }
    catch(error) { toast({type:'error',message:`Fichier invalide : ${String(error?.message || error)}`}); }
    finally { setBusy(false); }
  }
  async function runImport() { if (!selected) return; try { setBusy(true); await api('/api/bootstrap/import',{method:'POST',body:JSON.stringify({template:selected.template,sourcePath:selected.path})}); toast({message:'Configuration initiale importée.'}); await imported(); } catch(error) { toast({type:'error',message:error.message}); } finally { setBusy(false); } }
  async function skip() { try { setBusy(true); await api('/api/bootstrap/skip',{method:'POST'}); await manual(); } catch(error) { toast({type:'error',message:error.message}); } finally { setBusy(false); } }
  const count = Array.isArray(selected?.template?.destinations) ? selected.template.destinations.length : 0;
  return <div className="overlay first-run-overlay"><section className="modal first-run-modal"><header><div><span className="eyebrow">Premier lancement</span><h2>Initialiser Créateur d’AO</h2></div></header><p>Choisis le modèle de l’entreprise. Ses destinations et son arborescence seront copiées dans ta base locale une seule fois.</p><button className="config-file-button" onClick={choose} disabled={busy}><Icon name="folder"/><span><strong>{selected ? 'Modèle sélectionné' : 'Choisir le fichier de configuration'}</strong><small>{selected?.path || 'Fichier JSON placé sur le serveur'}</small></span><Icon name="right" size={16}/></button>{selected && <div className="config-summary"><span>{count} destination{count > 1 ? 's' : ''}</span><span>Arborescence incluse</span></div>}<small className="first-run-note">Après l’import, le fichier source n’est plus lu ni synchronisé.</small><footer><button className="secondary-button" onClick={skip} disabled={busy}>Configurer manuellement</button><button className="primary-button" onClick={runImport} disabled={!selected || busy}>{busy ? 'Import…' : 'Importer et continuer'}</button></footer></section></div>;
}

function SettingsPage({ settings, reload, toast }) {
  return <main className="content settings-page"><header className="page-title"><div><span className="eyebrow">Configuration</span><h1>Réglages</h1></div></header><BootstrapPanel settings={settings} toast={toast}/><DestinationEditor destinations={settings.destinations} reload={reload} toast={toast}/><TreeEditor initialTree={settings.tree} reload={reload} toast={toast}/></main>;
}

export default function App() {
  const [active,setActive] = useState('create');
  const [settings,setSettings] = useState({destinations:[],tree:[],onboardingComplete:true});
  const [offers,setOffers] = useState([]);
  const [toastValue,setToastValue] = useState(null);
  const [loading,setLoading] = useState(true);
  const toast = value => setToastValue({...value,key:Date.now()});
  async function loadSettings() { setSettings(await api('/api/settings')); }
  async function loadOffers() { setOffers(await api('/api/offers')); }
  async function loadAll() { try { await Promise.all([loadSettings(),loadOffers()]); } catch(error) { toast({type:'error',message:error.message}); } finally { setLoading(false); } }
  useEffect(() => { loadAll(); }, []);
  return <div className="app-shell"><Sidebar active={active} setActive={setActive}/>{loading ? <main className="content loading"><span/></main> : active === 'create' ? <CreatePage destinations={settings.destinations} reload={loadOffers} toast={toast}/> : active === 'history' ? <HistoryPage offers={offers} reload={loadOffers} toast={toast}/> : <SettingsPage settings={settings} reload={loadSettings} toast={toast}/>} {!loading && settings.onboardingComplete === false && <FirstRun toast={toast} imported={loadSettings} manual={async () => { await loadSettings(); setActive('settings'); }}/>}<Toast key={toastValue?.key} value={toastValue} close={() => setToastValue(null)}/></div>;
}
