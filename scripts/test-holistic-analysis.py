"""Excluded deterministic contracts for factorial signs and exact-bound endpoints."""
import csv,hashlib,json,math,subprocess
from pathlib import Path
base=Path('experiments/holistic/runs/excluded-analysis-contracts');base.mkdir(parents=True,exist_ok=True);profiles=json.loads(Path('experiments/holistic/profiles.json').read_text())['profiles'];pool=sorted((p for p in profiles if p['gap']==0),key=lambda p:p['id']);checks=[]
for mode in ['screen','confirmation']:
 d=base/mode;assert not d.exists();d.mkdir();records=[];rows=[]
 if mode=='screen':
  fixtures=[{'id':f'toy-{p["id"]}-{scene}-{trial}','profile':p['id'],'scene':scene,'trial':trial,'template':p['replicate'],'gap':p['gap'],'tactics':p['tactics'],'focalSide':trial%2}for p in profiles for scene in ['ordinary','hot-favored','hot-adverse','cold-favored','cold-adverse']for trial in range(4)];arms=[f'{i:03b}'for i in range(8)]
 else:
  fixtures=[];arms=['000','110','111']
  for scene in ['hot-favored','cold-adverse']:
   for side in [0,1]:
    for trial in range(128):
     domain=f'holistic-confirmation-mixture-v1:{scene}:{side}:{trial}';draw=hashlib.sha256((domain+':profile').encode()).hexdigest();p=pool[int(draw[:8],16)%8];fixtures.append({'id':f'toy-{scene}-{side}-{trial}','profile':p['id'],'scene':scene,'trial':trial,'template':p['replicate'],'gap':0,'tactics':p['tactics'],'focalSide':side,'seed':hashlib.sha256((domain+':gameplay').encode()).hexdigest(),'profileDrawSHA256':draw})
 for f in fixtures:
  rr=[]
  for arm in arms:
   win=int(arm[0])if mode=='screen'else f['trial']%2
   r={**{k:f[k]for k in ['profile','scene','trial','template','gap','tactics','focalSide']},'fixture':f['id'],'arm':arm,'focalWin':win,'margin':2*win-1,'focalChoice':'hold','opponentChoice':'hold','focalFinalEnergy':.8,'playingSeconds':100,'focalContacts':0,'focalSeverityIncidents':0,'focalSeriousFouls':0};rr.append(r);rows.append(r)
  records.append({'fixture':f,'arms':rr})
 manifest={'mode':mode,'testOnly':True,'sourceSHA256':'0'*64,'harnessSHA256':'0'*64,'arms':arms,'fixtures':fixtures};(d/'manifest.json').write_text(json.dumps(manifest));(d/'summary.json').write_text(json.dumps({'records':records}));(d/'ledger-verification.json').write_text(json.dumps({'status':'passed','testOnly':True,'fullOutcomesVerified':len(rows)}))
 with(d/'outcomes.csv').open('w')as out:
  writer=csv.DictWriter(out,fieldnames=list(rows[0]),lineterminator='\n');writer.writeheader();writer.writerows(rows)
 for cmd in [['node','--no-maglev','experiments/holistic/analyze.mjs',str(d)],['python3','experiments/holistic/recompute.py',str(d)]]:subprocess.run(cmd,check=True,capture_output=True,text=True)
 a=json.loads((d/'analysis.json').read_text())
 if mode=='screen':
  for c in a['factorial']:
   assert c['psychologyMainPP']==100
   for k,v in c.items():
    if k.endswith('PP')and k!='psychologyMainPP':assert v==0
  checks.append('Psychology-only artificial potential outcomes give100pp psychology, zero other main effects and all interactions.')
 else:
  inference=json.loads((d/'inference.json').read_text());u=100*(1-(.05/32)**(1/128))
  for c in inference['primaryContrasts']:assert c['winChangePP']==0 and abs(c['familyWise95IntervalPP'][0]+u)<1e-9 and abs(c['familyWise95IntervalPP'][1]-u)<1e-9
  checks.append('No-discordance artificial confirmation reproduces the closed-form zero-count exact interval and equal-orientation averaging.')
proof={'status':'passed','testOnly':True,'scientificOutcomesGenerated':0,'checks':checks,'methodCodeSHA256':hashlib.sha256(Path('experiments/holistic/recompute.py').read_bytes()).hexdigest()};(base/'verification.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
