from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
p = ROOT / 'tests' / 'workflow-v4.test.mjs'
t = p.read_text(encoding='utf-8')
old = """    await fs.writeFile(path.join(target4,'PRIX.txt'),'13 250 €','utf8');
    const priceScan=await json(base+'/api/scan-status',{method:'POST'});
    assert.equal(priceScan.prices,1);
    const repriced=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);
    assert.equal(repriced.price,'13250');
"""
new = """    // Le scan de statut ne lit plus tous les PRIX.txt du partage : cela évite
    // un accès réseau par AO et garde le bouton Scanner rapide.
    await fs.writeFile(path.join(target4,'PRIX.txt'),'13250','utf8');
    const statusOnlyScan=await json(base+'/api/scan-status',{method:'POST'});
    assert.equal(statusOnlyScan.prices,0);
"""
if old not in t:
    raise SystemExit('bloc de test prix beta4 introuvable')
p.write_text(t.replace(old,new,1),encoding='utf-8')
print('beta5 test fix applied')
