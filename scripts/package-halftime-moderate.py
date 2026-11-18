"""Freeze a compact review bundle without repository code or full event ledgers."""
import argparse,json,hashlib,subprocess,zipfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('study',type=Path);p.add_argument('report',type=Path);p.add_argument('output',type=Path);a=p.parse_args();proof=json.loads((a.study/'ledger-verification.json').read_text());assert proof['fullOutcomesVerified']==1152;items={}
for name in ['manifest.json','summary.json','outcomes.csv','analysis.json','ledger-verification.json','independent-recomputation.json','recovery-bound-verification.json','readiness-review.json']:items['study/'+name]=(a.study/name).read_bytes()
items['reproduction/profiles.json']=Path('experiments/halftime-moderate/profiles.json').read_bytes();items['plans/fixed-design.json']=Path('docs/halftime-moderate-workload-plan-2026-11-18.json').read_bytes();items['report/'+a.report.name]=a.report.read_bytes()
for f in Path('docs/verification/halftime-moderate-workload-2026-11-18').glob('*.json'):items['verification/'+f.name]=f.read_bytes()
for src,name in [('experiments/halftime-boundary/runs/qualification-final/checks/qualification.json','candidate-qualification.json'),('experiments/halftime-boundary/runs/qualification-final/boundary-checks.json','candidate-boundary-checks.json'),('experiments/halftime-boundary/runs/qualification-final/behavior-checks.json','candidate-behavior-checks.json'),('docs/verification/drop-counter-targeted-2026-11-17/storage-faults.json','unchanged-storage-fault-proof.json')]:items['verification/'+name]=Path(src).read_bytes()
revision=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip();items['README.txt']=f'''Century corrected halftime policy: matched-availability workload evaluation

576 paired cases /1152 full matches.72 synthetic profiles,18 contexts,4 templates.
16 excluded preflight outcomes.144 exact scientific replay receipts.
The corrected policy is unchanged from restored-halftime-policy-v2-boundary-canonical.
Both sides have28 or35 eligible players, matching initial workload roots2/3/4,
and moderate stamina8/recovery6 inputs before small opponent quality offsets.
Realized energy and competitiveness are reported; no physics/interval changes,
artificial energy injection, cross-match carry-over or official writes occur.
The single primary contrast is corrected policy versus Hold on pre-match focal
win probability, including no-ops. Its conservative95% heterogeneous-stream
Hoeffding interval was fixed before outcomes. Context, recipe, deficit, orientation
and energy/duration splits are descriptive. Earlier studies are never pooled.

Source repository: Golfhaus/CenturyLeague
Branch: lab/drop-counter-recovery-2026-11-17
Checkpoint: {revision}
Identify the exact candidate/harness by manifest checksums. Repository code is
maintained separately and not duplicated here. Exact generated profiles and all
CSV result hashes are included. Complete event ledgers remain local and separate.

Independent aggregate recomputation in the matching source checkout:
python3 experiments/halftime-moderate/recompute.py PATH/TO/study

This does not establish policy optimality, pass holistic acceptance, alter the
ongoing tournament engine or activate December v2. See readiness-review.json.
'''.encode();hashes={n:hashlib.sha256(b).hexdigest()for n,b in items.items()};items['SHA256SUMS.json']=(json.dumps(hashes,indent=2)+'\n').encode();a.output.parent.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(a.output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for n,b in items.items():z.writestr(n,b)
with zipfile.ZipFile(a.output)as z:
 assert z.testzip()is None
 for n,h in hashes.items():assert hashlib.sha256(z.read(n)).hexdigest()==h
print(json.dumps({'status':'passed','files':len(items),'bytes':a.output.stat().st_size,'sha256':hashlib.sha256(a.output.read_bytes()).hexdigest()}))
