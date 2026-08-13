from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"motif introuvable: {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Backend: le scan ne doit JAMAIS parcourir l'intérieur des AO.
# Les AO sont des enfants directs des dossiers 2/3/4/5 : on liste donc chaque
# dossier métier une seule fois. Cela transforme un crawl de milliers de dossiers
# SMB en quelques readdir seulement.
# ---------------------------------------------------------------------------
server_path = ROOT / 'server-v4.mjs'
s = server_path.read_text(encoding='utf-8')

start = s.find('async function scanStageDirectory(')
end = s.find('\nfunction localDateKey(', start)
if start < 0 or end < 0:
    raise SystemExit('bloc scan introuvable')

new_scan = r'''async function readDirectoryNames(root) {
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    return { ok: true, names: entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name) };
  } catch {
    return { ok: false, names: [] };
  }
}
function pathKey(value) {
  return path.resolve(String(value || '')).toLocaleLowerCase('fr');
}
function offerNameKey(value) {
  return String(value || '').toLocaleLowerCase('fr');
}
function updateDetectedOffer(offer, { status, finalPath, destinationName, basePath }) {
  if (offer.status === status && offer.final_path === finalPath && offer.destination_name === destinationName && offer.base_path === basePath) return 0;
  const at = nowIso();
  db.prepare("UPDATE offers SET status=?, final_path=?, destination_id=NULL, destination_name=?, base_path=?, department='', due_date=date_ao, last_actor_pc=?, updated_at=? WHERE uid=?")
    .run(status, finalPath, destinationName, basePath, 'SYSTEM', at, offer.uid);
  const fresh = offerByUid(offer.uid);
  queueEvent({ type:'offer.snapshot', offerUid:offer.uid, payload:{offer:serializeOffer(fresh)}, action:`Statut détecté : ${status}`, details:finalPath, status });
  return 1;
}
let scanBusy = false;
async function waitForScanIdle() {
  while (scanBusy) await new Promise((resolve) => setTimeout(resolve, 60));
}
async function scanStatuses({ waitForBusy = false } = {}) {
  if (scanBusy) {
    if (!waitForBusy) return { changed: 0, missing: 0, prices: 0, skipped: true };
    // Pas de timeout artificiel : le clic utilisateur attend le scan courant,
    // puis effectue réellement un nouveau scan avec l'état disque le plus récent.
    await waitForScanIdle();
  }

  scanBusy = true;
  const startedAt = Date.now();
  try {
    let changed = 0;
    let missing = 0;
    const offers = db.prepare('SELECT * FROM offers').all();
    const byName = new Map();
    for (const offer of offers) {
      const key = offerNameKey(offer.folder_name);
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push(offer);
    }

    const seen = new Set();
    const safeBases = new Set();
    const stages = [[2,'en_cours'],[3,'envoye'],[4,'gagne'],[5,'perdu']];
    const transferDestinations = db.prepare('SELECT id,name,path FROM transfer_destinations ORDER BY name COLLATE NOCASE').all();

    for (const destination of transferDestinations) {
      // Une seule lecture de la racine du département pour retrouver 2/3/4/5.
      const root = await readDirectoryNames(destination.path);
      if (!root.ok) continue;
      let complete = true;
      const rootEntries = root.names;

      for (const [number, status] of stages) {
        const prefix = `${number} `;
        const stageName = rootEntries.find((name) => name.trimStart().startsWith(prefix));
        if (!stageName) continue;
        const stagePath = path.join(destination.path, stageName);
        const listing = await readDirectoryNames(stagePath);
        if (!listing.ok) { complete = false; continue; }

        // IMPORTANT : on ne descend pas dans l'AO. Les dossiers internes de chaque
        // appel d'offres ne servent pas au statut et sont la cause du scan lent.
        for (const folderName of listing.names) {
          const candidates = byName.get(offerNameKey(folderName)) || [];
          for (const offer of candidates) {
            if (seen.has(offer.uid)) continue;
            seen.add(offer.uid);
            changed += updateDetectedOffer(offer, {
              status,
              finalPath: path.join(stagePath, folderName),
              destinationName: destination.name,
              basePath: destination.path
            });
            break;
          }
        }
      }
      if (complete) safeBases.add(pathKey(destination.path));
    }

    // Les AO qui n'ont pas encore été transférés sont directement dans les
    // destinations de création. On liste également ces racines une seule fois.
    const creationDestinations = db.prepare('SELECT id,name,path FROM destinations ORDER BY name COLLATE NOCASE').all();
    for (const destination of creationDestinations) {
      const listing = await readDirectoryNames(destination.path);
      if (!listing.ok) continue;
      safeBases.add(pathKey(destination.path));
      for (const folderName of listing.names) {
        const candidates = byName.get(offerNameKey(folderName)) || [];
        for (const offer of candidates) {
          if (seen.has(offer.uid)) continue;
          // Un AO déjà attribué à un service est trouvé dans 2/3/4/5 ci-dessus.
          // Ici on ne restaure que les AO de la zone de création.
          if (pathKey(offer.base_path) !== pathKey(destination.path) && offer.status !== 'a_attribuer' && offer.status !== 'introuvable') continue;
          seen.add(offer.uid);
          if (offer.status === 'introuvable' || offer.final_path !== path.join(destination.path, folderName)) {
            const at = nowIso();
            const finalPath = path.join(destination.path, folderName);
            db.prepare("UPDATE offers SET status='a_attribuer',final_path=?,destination_name=?,base_path=?,last_actor_pc=?,updated_at=? WHERE uid=?")
              .run(finalPath, destination.name, destination.path, 'SYSTEM', at, offer.uid);
            const fresh = offerByUid(offer.uid);
            queueEvent({ type:'offer.snapshot', offerUid:offer.uid, payload:{offer:serializeOffer(fresh)}, action:'Dossier retrouvé', details:finalPath, status:'a_attribuer' });
            changed += 1;
          }
          break;
        }
      }
    }

    // Introuvable n'est évalué qu'APRÈS avoir cherché l'AO dans tous les dossiers
    // 2/3/4/5. Ainsi un déplacement manuel 2 -> 4 devient directement Gagné.
    // Si la racine réseau n'a pas pu être lue, on ne conclut jamais à une suppression.
    for (const offer of offers) {
      if (!offer.uid || !offer.final_path || seen.has(offer.uid) || offer.status === 'introuvable') continue;
      if (!safeBases.has(pathKey(offer.base_path))) continue;
      const at = nowIso();
      db.prepare("UPDATE offers SET status='introuvable',last_actor_pc=?,updated_at=? WHERE uid=?").run('SYSTEM', at, offer.uid);
      const fresh = offerByUid(offer.uid);
      queueEvent({ type:'offer.snapshot', offerUid:offer.uid, payload:{offer:serializeOffer(fresh)}, action:'Dossier introuvable', details:offer.final_path, status:'introuvable' });
      missing += 1;
      changed += 1;
    }

    // Le scan de statut doit rester instantané. PRIX.txt est déjà lu lors du
    // transfert et écrit lorsque le prix est modifié dans l'application : on ne
    // fait plus un accès fichier réseau par AO à chaque scan de statut.
    return { changed, missing, prices: 0, durationMs: Date.now() - startedAt };
  } finally {
    scanBusy = false;
  }
}
'''

s = s[:start] + new_scan + s[end:]
server_path.write_text(s, encoding='utf-8')


# ---------------------------------------------------------------------------
# Frontend : prix affiché en 120 000€ (PRIX.txt reste 120000) + suivi basé sur
# le créateur d'origine, jamais sur la dernière personne/le SYSTEM qui a scanné.
# ---------------------------------------------------------------------------
app_path = ROOT / 'src' / 'AppV4.jsx'
a = app_path.read_text(encoding='utf-8')

a = replace_once(
    a,
    "return new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:0,maximumFractionDigits:2}).format(number);",
    "return `${new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2}).format(number).replace(/[\\u00a0\\u202f]/g,' ')}€`;",
    'currency display without nbsp before euro'
)

a = replace_once(
    a,
    "<div className=\"v4-track-actions\"><div className=\"muted-cell\"><strong>{row.lastActorName||row.lastActorPc||'—'}</strong><small>{row.updatedAt?new Date(row.updatedAt).toLocaleString('fr-FR'):''}</small></div><button type=\"button\" className=\"small-action\" onClick={followup}>Relance</button><small>{row.lastFollowupAt?`${row.lastFollowupAt} · ${row.followupCount}`:'Aucune relance'}</small></div>",
    "<div className=\"v4-track-actions\"><div className=\"muted-cell\" title=\"Créateur de l’AO · nom modifiable dans Réglages > Personnes\"><strong>{row.createdByName||row.createdByPc||'—'}</strong><small>{row.createdAt?new Date(row.createdAt).toLocaleString('fr-FR'):''}</small></div><button type=\"button\" className=\"small-action\" onClick={followup}>Relance</button><small>{row.lastFollowupAt?`${row.lastFollowupAt} · ${row.followupCount}`:'Aucune relance'}</small></div>",
    'tracking creator stays stable'
)

a = replace_once(
    a,
    '<span>AO</span><span>Client / BE</span><span>Contact</span><span>Prix</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Suivi</span>',
    '<span>AO</span><span>Client / BE</span><span>Contact</span><span>Prix</span><span>Destination</span><span>Statut</span><span>Échéance</span><span>Créateur / suivi</span>',
    'tracking creator header'
)

# Le message du scan montre aussi le temps réel pour diagnostiquer SIE15 sans
# donner l'impression que le bouton attend une sauvegarde.
a = replace_once(
    a,
    "else toast({message:'Scan terminé · aucun changement détecté.'});",
    "else toast({message:`Scan terminé en ${Math.max(0,Number(r.durationMs||0))/1000 < 1 ? '< 1' : (Number(r.durationMs||0)/1000).toFixed(1)} s · aucun changement détecté.`});",
    'scan duration feedback'
)

app_path.write_text(a, encoding='utf-8')


# ---------------------------------------------------------------------------
# Tests : beaucoup de sous-dossiers internes ne doivent plus être explorés.
# ---------------------------------------------------------------------------
test_path = ROOT / 'tests' / 'workflow-v4.test.mjs'
t = test_path.read_text(encoding='utf-8')
needle = """    const target3=path.join(cet,'3 Offre en attente de décision',moved.folderName);
    await fs.rename(moved.finalPath,target3);
    await json(base+'/api/scan-status',{method:'POST'});
"""
replacement = """    const target3=path.join(cet,'3 Offre en attente de décision',moved.folderName);
    await fs.rename(moved.finalPath,target3);
    // Le contenu interne d'un AO peut être volumineux : le scanner ne doit pas le parcourir.
    let deep=path.join(target3,'DOSSIER_INTERNE');
    for(let i=0;i<12;i++){deep=path.join(deep,'NIVEAU_'+i);await fs.mkdir(deep,{recursive:true});}
    const scan3=await json(base+'/api/scan-status',{method:'POST'});
    assert.ok(Number.isFinite(scan3.durationMs));
"""
t = replace_once(t, needle, replacement, 'fast direct-folder scan test')
test_path.write_text(t, encoding='utf-8')


# Version
pkg_path = ROOT / 'package.json'
pkg = json.loads(pkg_path.read_text(encoding='utf-8'))
pkg['version'] = '0.4.1-beta.5'
pkg_path.write_text(json.dumps(pkg, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('beta5 hotfix applied')
