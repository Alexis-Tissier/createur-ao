import test from 'node:test';
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
    await fs.rm(target4,{recursive:true,force:true});
    await json(base+'/api/scan-status',{method:'POST'});
    const missing=(await json(base+'/api/offers')).find(x=>x.uid===offer.uid);
    assert.equal(missing.status,'introuvable');
    const backup=await json(base+'/api/backups',{method:'POST'});
    assert.equal(backup.kind,'manual');
    assert.equal((await fs.stat(path.join(backup.path,'createur-ao.db'))).isFile(),true);
  }catch(error){throw new Error(error.message+'\n'+stderr);}finally{child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));await fs.rm(root,{recursive:true,force:true});}
});
