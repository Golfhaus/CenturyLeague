"""Package the review-first data, excluding source code and bulk future ledgers."""
import argparse,hashlib,json,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser(description=__doc__);p.add_argument('study',type=Path);p.add_argument('prefixes',type=Path);p.add_argument('report',type=Path);p.add_argument('output',type=Path);a=p.parse_args()
v=json.loads((a.study/'analysis.json').read_text());proof=json.loads((a.study/'ledger-verification.json').read_text());ind=json.loads((a.study/'independent-recomputation.json').read_text());m=json.loads((a.study/'manifest.json').read_text());assert v['outcomes']==proof['fullOutcomesVerified']==1024 and ind['status']=='passed'
items={}
for name in ['manifest.json','summary.json','outcomes.csv','analysis.json','ledger-verification.json','independent-recomputation.json']:items['study/'+name]=(a.study/name).read_bytes()
items['report/'+a.report.name]=a.report.read_bytes();items['verification/fixed-design.json']=Path('docs/drop-counter-targeted-plan-2026-11-17.json').read_bytes()
for src,name in [(a.study.parent/'recovery-qualification/checks/qualification.json','recovery-qualification.json'),(a.study.parent/'storage-faults.json','storage-faults.json'),(a.study.parent/'preflight/ledger-verification.json','preflight-verification.json')]:items['verification/'+name]=src.read_bytes()
for r in m['prefixes']:
 data=(a.prefixes/r['file']).read_bytes();assert hashlib.sha256(data).hexdigest()==r['fileSHA256'];items['prefixes/'+r['file']]=data
revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
items['README.txt']=f'''Century targeted drop-and-counter experiment

256 paired cases / 1024 fresh scientific outcomes. Eight excluded preflight outcomes.
Four arms: Hold; pressure -0.5; transition +0.5; pressure -0.5 plus transition +0.5.
Each shares one frozen state and seed. Primary: combined package minus Hold.
One conservative fixed 95% bound; components, interaction and subgroup splits are descriptive.
No seed replacement, sample extension, old-study pooling or official gameplay adoption.

The original local halftime adapter source was unavailable in this session. The new adapter
reuses the exactly recovered native v2 source and matched all saved compact score/clock/action
measurements for 1248 previous single-slider outcomes. This is not byte-identical historical
event reproduction: full historical future ledgers and the exact old adapter were unavailable.
Those qualification outcomes are excluded. Every fresh ledger was fully audited, with 64 replays.

Local code revision: {revision}
Adapter source SHA256: {v['sourceSHA256']}
Harness SHA256: {v['harnessSHA256']}
Outcome CSV SHA256: {v['outcomesCSVSHA256']}
Source branch: lab/drop-counter-recovery-2026-11-17
Publishing that branch is pending explicit approval; this revision is not yet a remote checkout.
Code is intentionally excluded from this data archive. Full fresh event ledgers are retained locally.

Independent aggregate reproduction needs only Python plus the matching source checkout:
  python3 experiments/drop-counter/recompute.py PATH/TO/study

With the matching source, build using tools.mjs load() under qualified Node v24.22.1 --no-maglev.
For a fixture, select its frozen prefix from manifest.prefixes, verify all hashes, and call resume
with the fixture trailingSide, exact manifest.armDeltas[arm] and fixture continuationSeed.
Every raw result hash is preserved in outcomes.csv. Never replace the original prefix identity.
'''.encode()
digests={k:hashlib.sha256(v).hexdigest()for k,v in items.items()};items['SHA256SUMS.json']=(json.dumps(digests,indent=2)+'\n').encode();a.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for n,data in items.items():z.writestr(n,data)
with zipfile.ZipFile(a.output)as z:
 assert z.testzip()is None
 for n,h in digests.items():assert hashlib.sha256(z.read(n)).hexdigest()==h
print(json.dumps({'status':'passed','files':len(items),'bytes':a.output.stat().st_size,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'fullFutureLedgersIncluded':False,'sourceCodeIncluded':False}))
