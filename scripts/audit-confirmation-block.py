"""Audit all retained event bytes in one checkpoint before durable publication."""
import csv,gzip,hashlib,json,subprocess,sys
from pathlib import Path
repo=Path(__file__).resolve().parents[1];p=Path(sys.argv[1]).resolve();block=int(sys.argv[2]);name=f'block-{block:03}';cp=json.loads(gzip.decompress((p/'checkpoints'/(name+'.json.gz')).read_bytes()));m=json.loads((p/'manifest.json').read_text());out=p/'checkpoints'/f'audit-{block:03}';out.mkdir(exist_ok=True);streams=[];children=[]
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
try:
 for i in range(8):
  assert not(out/f'{i}-ledger-verification.json').exists(),'Preserve earlier audit receipt; no automatic retry';stream=(out/f'{i}.log').open('wb');streams.append(stream);children.append(subprocess.Popen(['node','--no-maglev',str(repo/'scripts/audit-confirmation-block-shard.mjs'),str(p),str(block),str(i)],cwd=repo,stdout=stream,stderr=subprocess.STDOUT))
 codes=[c.wait()for c in children];assert codes==[0]*8,codes
finally:
 for c in children:
  if c.poll()is None:c.terminate()
 for c in children:c.wait()
 for s in streams:s.close()
proofs=[json.loads((out/f'{i}-ledger-verification.json').read_text())for i in range(8)];rows=[];keys=None
for i in range(8):
 with(out/f'{i}-outcomes.csv').open()as f:
  reader=csv.DictReader(f);assert keys is None or keys==reader.fieldnames;keys=reader.fieldnames;rows.extend(reader)
lookup={}
for r in rows:
 k=(r['fixture'],r['arm']);assert k not in lookup;lookup[k]=r
expected=[(r['fixture'],r['arm'])for r in cp['rows']];assert set(lookup)==set(expected);ordered=[lookup[k]for k in expected];text=','.join(keys)+'\n'+'\n'.join(','.join(r[k]for k in keys)for r in ordered)+'\n';(out/'outcomes.csv').write_text(text)
for old,r in zip(cp['rows'],ordered):
 for k in ['fixture','arm','resultSHA256','armFileSHA256','gameplaySHA256','firstHalfSHA256']:assert r[k]==old[k]
 for k in ['focalWin','margin','focalScore','opponentScore']:assert float(r[k])==old[k]
totals={}
for proof in proofs:
 assert proof['status']=='passed'and proof['sourceSHA256']==m['sourceSHA256']and proof['harnessSHA256']==m['harnessSHA256']
 for k,v in proof.items():
  if isinstance(v,int):totals[k]=totals.get(k,0)+v
assert totals['fullOutcomesVerified']==cp['outcomes']and totals['fixtureClusters']==cp['fixtures'];result={'status':'passed','blockIndex':block,'sourceSHA256':m['sourceSHA256'],'harnessSHA256':m['harnessSHA256'],**totals,'outcomesCSVSHA256':hashlib.sha256(text.encode()).hexdigest(),'checkpointSHA256':digest(p/'checkpoints'/(name+'.json.gz')),'pinnedAuditSHA256':digest(repo/'experiments/club-confirmation/audit.mjs'),'driverSHA256':digest(Path(__file__)),'shardSHA256':digest(repo/'scripts/audit-confirmation-block-shard.mjs')};(p/'checkpoints'/(name+'.audit.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
