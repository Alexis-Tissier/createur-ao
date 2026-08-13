from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"motif introuvable: {label}")
    return text.replace(old, new, 1)

# --- Backend -------------------------------------------------------------
server_path = ROOT / 'server-v4.mjs'
s = server_path.read_text(encoding='utf-8')

s = replace_once(
    s,
    "function normalizePrice(value) { return String(value ?? '').trim(); }\nasync function readOptionalTextFile(file) {",
    """function normalizePrice(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const compact = text
    .replace(/[\\u00a0\\u202f\\s€]/g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');
  if (!compact) return '';
  const number = Number(compact);
  if (!Number.isFinite(number) || number < 0) throw new Error('Prix invalide. Saisissez un montant numérique.');
  return Number.isInteger(number) ? String(number) : String(Math.round(number * 100) / 100);
}
async function readOptionalTextFile(file) {""",
    'normalize raw price'
)

s = replace_once(
    s,
    "async function readPriceFile(rootPath) { return readOptionalTextFile(path.join(rootPath, 'PRIX.txt')); }\nasync function writePriceFile(rootPath, value) { await fsp.writeFile(path.join(rootPath, 'PRIX.txt'), normalizePrice(value), 'utf8'); }",
    """async function readPriceFile(rootPath) {
  const result = await readOptionalTextFile(path.join(rootPath, 'PRIX.txt'));
  return { ...result, value: result.exists ? normalizePrice(result.value) : '' };
}
async function writePriceFile(rootPath, value) { await fsp.writeFile(path.join(rootPath, 'PRIX.txt'), normalizePrice(value), 'utf8'); }""",
    'price file raw normalization'
)

# Revenir à la logique beta2 pour Introuvable : on ne s'appuie pas sur le parent
# immédiat, seulement sur la racine métier connue afin d'éviter les faux positifs
# lors d'un déplacement SMB en cours.
s = replace_once(
    s,
    """    const parentStat = await fsp.stat(path.dirname(row.final_path)).catch(() => null);
    const baseStat = row.base_path ? await fsp.stat(row.base_path).catch(() => null) : null;
    if (!parentStat?.isDirectory() && !baseStat?.isDirectory()) continue; // partage indisponible : ne pas conclure à une suppression
""",
    """    const baseStat = row.base_path ? await fsp.stat(row.base_path).catch(() => null) : null;
    if (!baseStat?.isDirectory()) continue; // chemin réseau indisponible : ne pas conclure à une suppression
""",
    'restore beta2 missing detection'
)

s = replace_once(
    s,
    "let scanBusy = false;\nasync function markMissingOffers() {",
    """let scanBusy = false;
async function waitForScanIdle(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (scanBusy && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 75));
  if (scanBusy) throw new Error('Le scan précédent prend trop de temps. Réessayez dans quelques secondes.');
}
async function markMissingOffers() {""",
    'scan wait helper'
)

s = replace_once(
    s,
    "async function scanStatuses() {\n  if (scanBusy) return { changed: 0, missing: 0, prices: 0 };\n  scanBusy = true;",
    """async function scanStatuses({ waitForBusy = false } = {}) {
  if (scanBusy) {
    if (!waitForBusy) return { changed: 0, missing: 0, prices: 0, skipped: true };
    await waitForScanIdle();
  }
  scanBusy = true;""",
    'manual scan wait'
)

s = replace_once(
    s,
    "app.post('/api/scan-status', async (_req, res) => res.json(await scanStatuses()));",
    """app.post('/api/scan-status', async (_req, res) => {
  try {
    // Le clic utilisateur attend la fin d'un éventuel scan automatique puis lance
    // toujours un NOUVEAU scan, au lieu de retourner silencieusement « 0 changement ».
    const result = await scanStatuses({ waitForBusy: true });
    void syncMaster();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error?.message || error) });
  }
});""",
    'manual scan endpoint'
)

server_path.write_text(s, encoding='utf-8')

# --- React ---------------------------------------------------------------
app_path = ROOT / 'src' / 'AppV4.jsx'
a = app_path.read_text(encoding='utf-8')

contact_marker = """function ContactCellV4({value}){
  const text=String(value||'').trim();
  if(!text)return <span className=\"muted-cell\">—</span>;
  const href=contactHref(text);
  return href?<a className=\"v4-contact-link\" href={href} target=\"_blank\" rel=\"noreferrer\" title={text}>{text}</a>:<span className=\"v4-contact-text\" title={text}>{text}</span>;
}
"""
price_helpers = contact_marker + """function rawPriceInput(value){
  const text=String(value??'').trim();
  if(!text)return '';
  const compact=text.replace(/[\\u00a0\\u202f\\s€]/g,'').replace(',','.').replace(/[^0-9.-]/g,'');
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
"""
a = replace_once(a, contact_marker, price_helpers, 'price format helpers')

old_price_cell = """function PriceCellV4({row,reload,toast}){
  const [value,setValue]=useState(row.price||'');const [busy,setBusy]=useState(false);
  useEffect(()=>setValue(row.price||''),[row.uid,row.price]);
  async function save(){
    const next=String(value||'').trim();
    if(next===String(row.price||'').trim())return;
    try{setBusy(true);await api(`/api/offers/${row.uid}`,{method:'PATCH',body:JSON.stringify({price:next})});await reload();toast({message:'Prix enregistré.'});}
    catch(error){setValue(row.price||'');toast({type:'error',message:error.message});}
    finally{setBusy(false);}
  }
  return <input className=\"v4-price-input\" value={value} disabled={busy} onChange={e=>setValue(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} placeholder=\"—\" title=\"Le montant est aussi écrit dans PRIX.txt\"/>;
}
"""
new_price_cell = """function PriceCellV4({row,reload,toast}){
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
  return <input className=\"v4-price-input\" inputMode=\"decimal\" value={editing?value:formatPriceCurrency(value)} disabled={busy} onFocus={()=>{setEditing(true);setValue(row.price||'');}} onChange={e=>setValue(e.target.value)} onBlur={save} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}} placeholder=\"—\" title=\"Affichage en euros · PRIX.txt contient uniquement le nombre brut\"/>;
}
"""
a = replace_once(a, old_price_cell, new_price_cell, 'formatted price cell')

# Sur le bouton, rendre explicite que le clic effectue un scan neuf et attendre la réponse.
a = replace_once(
    a,
    "const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);",
    "const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [destination,setDestination]=useState('');const [followup,setFollowup]=useState(null);const [scanning,setScanning]=useState(false);",
    'tracking scan busy state'
)

a = replace_once(
    a,
    """  async function scan(){
    try{
      const r=await api('/api/scan-status',{method:'POST'});await reload();
      if(r.missing)toast({message:`${r.missing} dossier(s) introuvable(s) détecté(s).`});
      else if(r.changed)toast({message:`${r.changed} changement(s) détecté(s)${r.prices?` · ${r.prices} prix mis à jour`:''}.`});
      else toast({message:'Aucun changement détecté.'});
    }catch(error){toast({type:'error',message:error.message});}
  }
""",
    """  async function scan(){
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
""",
    'immediate scan UI'
)

a = replace_once(
    a,
    "<button type=\"button\" className=\"secondary-button\" onClick={scan}><Icon name=\"refresh\" size={15}/>Scanner les emplacements</button>",
    "<button type=\"button\" className=\"secondary-button\" onClick={scan} disabled={scanning}><Icon name=\"refresh\" size={15}/>{scanning?'Scan en cours…':'Scanner les emplacements'}</button>",
    'scan button busy label'
)

app_path.write_text(a, encoding='utf-8')

# --- CSS -----------------------------------------------------------------
css_path = ROOT / 'src' / 'styles.css'
c = css_path.read_text(encoding='utf-8')
if '.v4-price-input{' in c and 'font-variant-numeric:tabular-nums' not in c:
    c = c.replace('.v4-price-input{', '.v4-price-input{font-variant-numeric:tabular-nums;text-align:right;', 1)
css_path.write_text(c, encoding='utf-8')

# --- Tests ---------------------------------------------------------------
test_path = ROOT / 'tests' / 'workflow-v4.test.mjs'
t = test_path.read_text(encoding='utf-8')
t = t.replace("assert.equal(offer.price,'12 500 €');", "assert.equal(offer.price,'12500');")
t = t.replace("assert.equal((await fs.readFile(path.join(offer.finalPath,'PRIX.txt'),'utf8')).trim(),'12 500 €');", "assert.equal((await fs.readFile(path.join(offer.finalPath,'PRIX.txt'),'utf8')).trim(),'12500');")
t = t.replace("assert.equal(repriced.price,'13 250 €');", "assert.equal(repriced.price,'13250');")
t = t.replace("assert.equal((await fs.readFile(path.join(target4,'PRIX.txt'),'utf8')).trim(),'14 000 €');", "assert.equal((await fs.readFile(path.join(target4,'PRIX.txt'),'utf8')).trim(),'14000');")
test_path.write_text(t, encoding='utf-8')

# --- Version -------------------------------------------------------------
pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.4'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('beta4 hotfix applied')
